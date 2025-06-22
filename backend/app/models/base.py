from sqlalchemy.orm import declared_attr, DeclarativeBase


class Base(DeclarativeBase):
    id: int
    __name__: str

    __allow__unmapped__ = True

    @declared_attr
    def __tablename__(self) -> str:
        return self.__name__.lower()
