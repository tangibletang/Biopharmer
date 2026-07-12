import os
import alpaca_trade_api as tradeapi


class AlpacaClient:
    def __init__(self):
        live = os.environ.get("ALPACA_LIVE_MODE", "false").lower() == "true"
        base_url = (
            "https://api.alpaca.markets"
            if live
            else "https://paper-api.alpaca.markets"
        )
        self._api = tradeapi.REST(
            key_id=os.environ["ALPACA_API_KEY"],
            secret_key=os.environ["ALPACA_SECRET_KEY"],
            base_url=base_url,
            api_version="v2",
        )
        self.live = live

    def get_account(self) -> dict:
        return self._api.get_account()._raw

    def get_portfolio(self) -> dict:
        account = self._api.get_account()
        positions = self._api.list_positions()
        return {
            "portfolio_value": float(account.equity),
            "cash": float(account.cash),
            "positions": [self._position_to_dict(p) for p in positions],
            "account_mode": "live" if self.live else "paper",
        }

    def submit_order(self, symbol: str, side: str, notional: float) -> dict:
        order = self._api.submit_order(
            symbol=symbol,
            side=side,
            type="market",
            time_in_force="day",
            notional=round(notional, 2),
        )
        return order._raw

    def submit_order_qty(self, symbol: str, side: str, qty: float) -> dict:
        order = self._api.submit_order(
            symbol=symbol,
            side=side,
            type="market",
            time_in_force="day",
            qty=qty,
        )
        return order._raw

    def get_position(self, symbol: str) -> dict | None:
        try:
            return self._api.get_position(symbol)._raw
        except Exception:
            return None

    def get_recent_trades(self, limit: int = 20) -> list[dict]:
        orders = self._api.list_orders(
            status="filled", limit=limit, direction="desc"
        )
        return [o._raw for o in orders]

    def is_fractionable(self, symbol: str) -> bool:
        try:
            asset = self._api.get_asset(symbol)
            return asset.fractionable
        except Exception:
            return False

    def _position_to_dict(self, p) -> dict:
        return {
            "symbol": p.symbol,
            "qty": float(p.qty),
            "market_value": float(p.market_value),
            "avg_entry_price": float(p.avg_entry_price),
            "unrealized_pl": float(p.unrealized_pl),
            "unrealized_plpc": float(p.unrealized_plpc),
            "current_price": float(p.current_price),
        }
