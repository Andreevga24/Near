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
from app.models.user_workspace_store import UserWorkspaceStore
from app.models.project_member import ProjectMember
from app.models.project_invite import ProjectInvite
from app.models.user_notification import UserNotification
from app.models.support_ticket import SupportTicket
from app.models.support_ticket_reply import SupportTicketReply
from app.models.chat_channel import ChatChannel
from app.models.chat_message import ChatMessage
from app.models.task_time_entry import TaskTimeEntry
from app.models.user_consent_log import UserConsentLog

__all__ = (
    "User",
    "Project",
    "Task",
    "Comment",
    "TaskLink",
    "TaskActivity",
    "TaskChecklistItem",
    "KindPreset",
    "UserWorkspaceStore",
    "ProjectMember",
    "ProjectInvite",
    "UserNotification",
    "SupportTicket",
    "SupportTicketReply",
    "ChatChannel",
    "ChatMessage",
    "TaskTimeEntry",
    "UserConsentLog",
)
