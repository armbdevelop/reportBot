from sqlalchemy import Column, String, DateTime, func, Integer, SmallInteger

from .base import Base


class DailyInventory(Base):
    id = Column(Integer, primary_key=True, index=True)


    location = Column(String(255), nullable=False)
    shift_type = Column(String(20), nullable=False)  # "morning" или "night"
    date = Column(DateTime(timezone=True), nullable=False)
    cashier_name = Column(String(255), nullable=False)

    # Товар
    il_primo_steklo = Column(SmallInteger, nullable=False)
    voda_gornaya = Column(SmallInteger, nullable=False)
    dobri_sok_pet = Column(SmallInteger, nullable=False)
    kuragovi_kompot = Column(SmallInteger, nullable=False)
    napitki_jb = Column(SmallInteger, nullable=False)
    energetiky = Column(SmallInteger, nullable=False)
    kold_bru = Column(SmallInteger, nullable=False)
    kinza_napitky = Column(SmallInteger, nullable=False)
    palli = Column(SmallInteger, nullable=False)
    barbeku_dip = Column(SmallInteger, nullable=False)
    bulka_na_shaurmu = Column(SmallInteger, nullable=False)
    lavash = Column(SmallInteger, nullable=False)
    lepeshki = Column(SmallInteger, nullable=False)
    ketchup_dip = Column(SmallInteger, nullable=False)
    sirny_sous_dip = Column(SmallInteger, nullable=False)
    kuriza_jareny = Column(SmallInteger, nullable=False)
    kuriza_siraya = Column(SmallInteger, nullable=False)
