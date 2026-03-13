"""
Predictive Restocking Engine
Supports Prophet (primary) with ARIMA fallback.
"""
import pandas as pd
import numpy as np
from datetime import datetime, timedelta
from typing import Optional, List, Tuple
import logging
import warnings

warnings.filterwarnings("ignore")
logger = logging.getLogger(__name__)


# Academic demand cycle weights (month -> relative demand multiplier)
ACADEMIC_DEMAND_CYCLE = {
    1: 1.2,   # January - new semester
    2: 1.1,
    3: 1.0,
    4: 0.9,
    5: 1.3,   # May - end of semester / exams
    6: 0.6,   # Summer
    7: 0.5,
    8: 0.7,
    9: 1.4,   # September - back to school
    10: 1.1,
    11: 1.0,
    12: 0.8,  # December holidays
}


class ForecastResult:
    def __init__(
        self,
        item_id: str,
        predicted_stockout_date: Optional[datetime],
        recommended_restock_qty: int,
        daily_consumption_rate: float,
        confidence_score: float,
        forecast_data: List[dict],
        model_used: str,
        days_until_stockout: Optional[int],
    ):
        self.item_id = item_id
        self.predicted_stockout_date = predicted_stockout_date
        self.recommended_restock_qty = recommended_restock_qty
        self.daily_consumption_rate = daily_consumption_rate
        self.confidence_score = confidence_score
        self.forecast_data = forecast_data
        self.model_used = model_used
        self.days_until_stockout = days_until_stockout


class InventoryForecaster:
    """
    AI forecasting engine for inventory management.
    Uses Prophet for time-series prediction with academic cycle adjustments.
    Falls back to ARIMA or simple linear regression when insufficient data.
    """

    def __init__(self, forecast_horizon_days: int = 30, min_history_days: int = 14):
        self.forecast_horizon = forecast_horizon_days
        self.min_history = min_history_days

    def forecast(
        self,
        item_id: str,
        current_quantity: int,
        usage_history: List[dict],  # [{date: datetime, quantity_consumed: int}]
        minimum_threshold: int = 10,
        reorder_quantity: int = 50,
        lead_time_days: int = 7,
    ) -> ForecastResult:
        """
        Main forecast entry point. Selects best model based on data availability.
        """
        if not usage_history or len(usage_history) < 3:
            return self._fallback_simple(
                item_id, current_quantity, minimum_threshold,
                reorder_quantity, lead_time_days
            )

        df = self._prepare_dataframe(usage_history)

        if len(df) >= self.min_history:
            try:
                return self._prophet_forecast(
                    item_id, current_quantity, df, minimum_threshold,
                    reorder_quantity, lead_time_days
                )
            except Exception as e:
                logger.warning(f"Prophet failed for {item_id}: {e}, trying ARIMA")

        try:
            return self._arima_forecast(
                item_id, current_quantity, df, minimum_threshold,
                reorder_quantity, lead_time_days
            )
        except Exception as e:
            logger.warning(f"ARIMA failed for {item_id}: {e}, using linear fallback")
            return self._linear_forecast(
                item_id, current_quantity, df, minimum_threshold,
                reorder_quantity, lead_time_days
            )

    def _prepare_dataframe(self, usage_history: List[dict]) -> pd.DataFrame:
        """Convert usage logs to daily aggregated DataFrame."""
        df = pd.DataFrame(usage_history)
        df["date"] = pd.to_datetime(df["date"]).dt.date
        df = df.groupby("date")["quantity_consumed"].sum().reset_index()
        df.columns = ["ds", "y"]
        df["ds"] = pd.to_datetime(df["ds"])
        df = df[df["y"] > 0].sort_values("ds")

        # Fill missing dates with 0
        if len(df) > 0:
            date_range = pd.date_range(df["ds"].min(), df["ds"].max())
            df = df.set_index("ds").reindex(date_range, fill_value=0).reset_index()
            df.columns = ["ds", "y"]

        return df

    def _apply_academic_seasonality(self, df: pd.DataFrame) -> pd.DataFrame:
        """Apply academic demand cycle weights to consumption data."""
        df = df.copy()
        df["academic_weight"] = df["ds"].dt.month.map(ACADEMIC_DEMAND_CYCLE)
        df["y_adjusted"] = df["y"] * df["academic_weight"]
        return df

    def _prophet_forecast(
        self, item_id, current_quantity, df, minimum_threshold,
        reorder_quantity, lead_time_days
    ) -> ForecastResult:
        """Use Facebook Prophet for time-series forecasting."""
        from prophet import Prophet

        df_adjusted = self._apply_academic_seasonality(df)

        model = Prophet(
            yearly_seasonality=True,
            weekly_seasonality=True,
            daily_seasonality=False,
            changepoint_prior_scale=0.05,
            seasonality_prior_scale=10,
            interval_width=0.95,
        )

        # Add custom academic seasonality
        model.add_seasonality(
            name="academic_cycle",
            period=365.25,
            fourier_order=5,
            prior_scale=10,
        )

        train_df = df[["ds", "y"]].copy()
        model.fit(train_df)

        future = model.make_future_dataframe(periods=self.forecast_horizon)
        forecast = model.predict(future)

        # Get future predictions only
        future_forecast = forecast[forecast["ds"] > df["ds"].max()].copy()
        future_forecast["yhat"] = future_forecast["yhat"].clip(lower=0)
        future_forecast["yhat_lower"] = future_forecast["yhat_lower"].clip(lower=0)
        future_forecast["yhat_upper"] = future_forecast["yhat_upper"].clip(lower=0)

        # Apply academic cycle to future predictions
        future_forecast["month"] = future_forecast["ds"].dt.month
        future_forecast["academic_weight"] = future_forecast["month"].map(ACADEMIC_DEMAND_CYCLE)
        future_forecast["yhat"] = future_forecast["yhat"] * future_forecast["academic_weight"]

        # Calculate stockout
        stockout_info = self._calculate_stockout(
            current_quantity, future_forecast["yhat"].values,
            minimum_threshold, lead_time_days
        )

        daily_rate = df["y"].tail(30).mean()
        restock_qty = self._calculate_restock_qty(
            daily_rate, reorder_quantity, lead_time_days, minimum_threshold
        )

        confidence = min(0.95, 0.5 + len(df) / 200)

        forecast_data = [
            {
                "date": row["ds"].isoformat(),
                "predicted": round(max(0, row["yhat"]), 2),
                "lower": round(max(0, row["yhat_lower"]), 2),
                "upper": round(max(0, row["yhat_upper"]), 2),
            }
            for _, row in future_forecast.iterrows()
        ]

        return ForecastResult(
            item_id=item_id,
            predicted_stockout_date=stockout_info[0],
            days_until_stockout=stockout_info[1],
            recommended_restock_qty=restock_qty,
            daily_consumption_rate=round(daily_rate, 3),
            confidence_score=round(confidence, 3),
            forecast_data=forecast_data,
            model_used="prophet",
        )

    def _arima_forecast(
        self, item_id, current_quantity, df, minimum_threshold,
        reorder_quantity, lead_time_days
    ) -> ForecastResult:
        """Use ARIMA for forecasting (fewer data points needed)."""
        from statsmodels.tsa.arima.model import ARIMA
        from statsmodels.tsa.statespace.sarimax import SARIMAX

        y = df["y"].values.astype(float)

        # Auto-select ARIMA order
        try:
            model = SARIMAX(y, order=(2, 1, 2), seasonal_order=(1, 1, 1, 7))
            result = model.fit(disp=False)
        except Exception:
            model = ARIMA(y, order=(2, 1, 2))
            result = model.fit()

        forecast_values = result.forecast(steps=self.forecast_horizon)
        forecast_values = np.clip(forecast_values, 0, None)

        # Build forecast dates
        last_date = df["ds"].max()
        forecast_dates = [last_date + timedelta(days=i + 1) for i in range(self.forecast_horizon)]

        # Apply academic weights
        weighted = [
            v * ACADEMIC_DEMAND_CYCLE[d.month]
            for v, d in zip(forecast_values, forecast_dates)
        ]

        stockout_info = self._calculate_stockout(
            current_quantity, weighted, minimum_threshold, lead_time_days
        )

        daily_rate = df["y"].tail(30).mean()
        restock_qty = self._calculate_restock_qty(
            daily_rate, reorder_quantity, lead_time_days, minimum_threshold
        )

        forecast_data = [
            {
                "date": d.isoformat(),
                "predicted": round(v, 2),
                "lower": round(v * 0.8, 2),
                "upper": round(v * 1.2, 2),
            }
            for d, v in zip(forecast_dates, weighted)
        ]

        return ForecastResult(
            item_id=item_id,
            predicted_stockout_date=stockout_info[0],
            days_until_stockout=stockout_info[1],
            recommended_restock_qty=restock_qty,
            daily_consumption_rate=round(daily_rate, 3),
            confidence_score=0.70,
            forecast_data=forecast_data,
            model_used="arima",
        )

    def _linear_forecast(
        self, item_id, current_quantity, df, minimum_threshold,
        reorder_quantity, lead_time_days
    ) -> ForecastResult:
        """Simple linear regression fallback."""
        from sklearn.linear_model import LinearRegression

        X = np.arange(len(df)).reshape(-1, 1)
        y = df["y"].values

        reg = LinearRegression()
        reg.fit(X, y)

        future_X = np.arange(len(df), len(df) + self.forecast_horizon).reshape(-1, 1)
        predicted = np.clip(reg.predict(future_X), 0, None)

        last_date = df["ds"].max() if len(df) > 0 else datetime.utcnow()
        forecast_dates = [last_date + timedelta(days=i + 1) for i in range(self.forecast_horizon)]

        weighted = [
            v * ACADEMIC_DEMAND_CYCLE[d.month]
            for v, d in zip(predicted, forecast_dates)
        ]

        stockout_info = self._calculate_stockout(
            current_quantity, weighted, minimum_threshold, lead_time_days
        )

        daily_rate = float(np.mean(y[-14:])) if len(y) >= 14 else float(np.mean(y))

        forecast_data = [
            {"date": d.isoformat(), "predicted": round(v, 2), "lower": round(v * 0.7, 2), "upper": round(v * 1.3, 2)}
            for d, v in zip(forecast_dates, weighted)
        ]

        return ForecastResult(
            item_id=item_id,
            predicted_stockout_date=stockout_info[0],
            days_until_stockout=stockout_info[1],
            recommended_restock_qty=self._calculate_restock_qty(daily_rate, reorder_quantity, lead_time_days, minimum_threshold),
            daily_consumption_rate=round(daily_rate, 3),
            confidence_score=0.55,
            forecast_data=forecast_data,
            model_used="linear_regression",
        )

    def _fallback_simple(
        self, item_id, current_quantity, minimum_threshold, reorder_quantity, lead_time_days
    ) -> ForecastResult:
        """No history available - return conservative estimates."""
        return ForecastResult(
            item_id=item_id,
            predicted_stockout_date=None,
            days_until_stockout=None,
            recommended_restock_qty=reorder_quantity,
            daily_consumption_rate=0.0,
            confidence_score=0.0,
            forecast_data=[],
            model_used="insufficient_data",
        )

    def _calculate_stockout(
        self, current_qty: int, daily_consumption: list,
        threshold: int, lead_time: int
    ) -> Tuple[Optional[datetime], Optional[int]]:
        """Calculate when stock will drop below threshold."""
        remaining = current_qty
        today = datetime.utcnow()

        for i, daily in enumerate(daily_consumption):
            remaining -= daily
            if remaining <= threshold:
                stockout_date = today + timedelta(days=i + 1)
                return stockout_date, i + 1

        return None, None

    def _calculate_restock_qty(
        self, daily_rate: float, base_qty: int, lead_time: int, threshold: int
    ) -> int:
        """Calculate recommended restock quantity."""
        if daily_rate <= 0:
            return base_qty

        # Cover lead time + 30-day buffer
        qty = int(daily_rate * (lead_time + 30) + threshold * 1.5)
        return max(qty, base_qty)


# Singleton instance
forecaster = InventoryForecaster()
