from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    database_url: str
    jwt_secret: str
    jwt_algorithm: str = "HS256"
    jwt_expire_minutes: int = 480
    upload_dir: str = "/data/uploads"
    first_admin_email: str = ""
    first_admin_password: str = ""
    cors_origins: str = "*"

    class Config:
        env_file = ".env"

settings = Settings()
