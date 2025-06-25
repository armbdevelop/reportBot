import base64
import os
import uuid
from pathlib import Path
from fastapi import HTTPException, UploadFile


class FileService:
    def __init__(self, upload_folder: str = "./uploads"):
        self.upload_folder = Path(upload_folder)
        self.upload_folder.mkdir(exist_ok=True)

        # Создаем папку для фото отчетов смен
        self.shift_reports_folder = self.upload_folder / "shift_reports"
        self.shift_reports_folder.mkdir(exist_ok=True)

    def save_shift_report_photo(self, photo: UploadFile) -> str:
        """
        Сохраняет фото отчета смены и возвращает путь к файлу.
        """
        try:
            # Проверяем, что файл загружен
            if not photo or not photo.filename:
                raise HTTPException(status_code=400, detail="Файл не загружен")

            # Проверяем тип файла
            allowed_extensions = {'.jpg', '.jpeg', '.png', '.gif', '.bmp'}
            file_ext = Path(photo.filename).suffix.lower()

            if file_ext not in allowed_extensions:
                raise HTTPException(
                    status_code=400,
                    detail=f"Недопустимый тип файла. Разрешены: {', '.join(allowed_extensions)}"
                )

            # Генерируем уникальное имя файла
            file_name = f"{uuid.uuid4()}{file_ext}"
            file_path = self.shift_reports_folder / file_name  # Исправлено!

            # Сохраняем файл
            with open(file_path, "wb") as buffer:
                content = photo.file.read()
                buffer.write(content)

            # Сбрасываем указатель файла на начало для возможного повторного использования
            photo.file.seek(0)

            # Возвращаем относительный путь
            return str(file_path)

        except Exception as e:
            if isinstance(e, HTTPException):
                raise e
            raise HTTPException(status_code=500, detail=f"Ошибка сохранения файла: {str(e)}")

    def get_shift_report_photo_url(self, file_path: str) -> str:
        """
        Возвращает URL для доступа к фото отчета.
        """
        if not os.path.exists(file_path):
            raise HTTPException(status_code=404, detail="Файл не найден")

        # Возвращаем относительный путь для API
        relative_path = Path(file_path).relative_to(self.upload_folder)
        return f"/uploads/{relative_path}"

    def delete_shift_report_photo(self, file_path: str) -> bool:
        """
        Удаляет фото отчета.
        """
        try:
            if os.path.exists(file_path):
                os.remove(file_path)
                return True
            return False
        except Exception:
            return False