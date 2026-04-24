from pydantic_settings import BaseSettings, SettingsConfigDict

class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    database_url: str
    jwt_secret: str
    jwt_algorithm: str = "HS256"
    jwt_expire_minutes: int = 480
    upload_dir: str = "/data/uploads"
    first_admin_email: str = ""
    first_admin_password: str = ""
    cors_origins: str = "*"

settings = Settings()
