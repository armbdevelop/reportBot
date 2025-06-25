from sqlalchemy import Column, Integer, String, DateTime, func, JSON

from .base import Base

class ReportOnGoods(Base):
    id = Column(Integer, primary_key=True, index=True)

    location = Column(String(255), nullable=False)
    date = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    shift_type = Column(String(20), nullable=False)  # "morning" или "night"
    cashier_name = Column(String(255), nullable=False)

    # КУХНЯ
    kuxnya = Column(JSON, nullable=False, default=list)

    #БАР
    bar = Column(JSON, nullable=False, default=list)

    # Упаковки/хоз
    upakovki_xoz = Column(JSON, nullable=False, default=list)
