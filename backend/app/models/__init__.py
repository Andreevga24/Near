"""
ORM-модели. Импорт всех модулей нужен Alembic (metadata со всех таблиц).
"""

from app.models.user import User
from app.models.project import Project
from app.models.task import Task
from app.models.comment import Comment
from app.models.task_link import TaskLink
from app.models.task_activity import TaskActivity
from app.models.task_checklist_item import TaskChecklistItem
from app.models.kind_preset import KindPreset

__all__ = (
    "User",
    "Project",
    "Task",
    "Comment",
    "TaskLink",
    "TaskActivity",
    "TaskChecklistItem",
    "KindPreset",
)
