"""
Application configuration and constants for the Options Execution Portal.
"""

from datetime import time
from enum import Enum
from zoneinfo import ZoneInfo

# ---------------------------------------------------------------------------
# Timezone
# ---------------------------------------------------------------------------
IST = ZoneInfo("Asia/Kolkata")

# ---------------------------------------------------------------------------
# Market hours (NSE equity derivatives)
# ---------------------------------------------------------------------------
MARKET_OPEN = time(9, 15)
MARKET_CLOSE = time(15, 30)

# ---------------------------------------------------------------------------
# Index definitions
# ---------------------------------------------------------------------------

class IndexName(str, Enum):
    NIFTY = "NIFTY"
    SENSEX = "SENSEX"


# Lot sizes (update if exchange revises them)
LOT_SIZES: dict[str, int] = {
    IndexName.NIFTY: 25,
    IndexName.SENSEX: 20,
}

# Underlying security IDs used by Dhan for spot price lookups
UNDERLYING_SECURITY_IDS: dict[str, int] = {
    IndexName.NIFTY: 13,       # NIFTY 50 index
    IndexName.SENSEX: 51,      # SENSEX index
}

# Strike gap (distance between consecutive strikes)
STRIKE_GAPS: dict[str, int] = {
    IndexName.NIFTY: 50,
    IndexName.SENSEX: 100,
}

# Exchange segments used in the Dhan API
EXCHANGE_SEGMENTS: dict[str, str] = {
    IndexName.NIFTY: "NSE_FNO",
    IndexName.SENSEX: "BSE_FNO",
}

# Instrument master CSV URL (public Dhan endpoint)
INSTRUMENT_MASTER_URL = "https://images.dhan.co/api-data/api-scrip-master.csv"

# Path to cache the downloaded master CSV
MASTER_CSV_PATH = "instrument_master.csv"

# ---------------------------------------------------------------------------
# Strategy names
# ---------------------------------------------------------------------------

class StrategyType(str, Enum):
    SHORT_STRADDLE = "short_straddle"
    PREMIUM_BASED = "premium_based"
    SPOT_STRANGLE = "spot_strangle"
