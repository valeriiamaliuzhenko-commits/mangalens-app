from django.urls import path
from .views import (
    RegisterView, LoginView, LogoutView, DeleteAccountView,
    HealthCheckView,
    MangaListView, MangaUpdateView, UploadMangaView,
    GetPageView, TranslatePageView, BulkTranslateView,
    UpdateProgressView, ResetProgressView,
    DeleteMangaView,
    NoteListView, NoteCreateView, NoteDeleteView,
    SeriesListView, SeriesCreateView, SeriesDetailView, SeriesChapterNavView,
    StatsView, DetailedStatsView,
)

urlpatterns = [
    # Auth — no token required
    path("auth/register/", RegisterView.as_view()),
    path("auth/login/", LoginView.as_view()),
    path("auth/logout/", LogoutView.as_view()),
    path("auth/delete/", DeleteAccountView.as_view()),

    path("health/", HealthCheckView.as_view()),

    path("series/", SeriesListView.as_view()),
    path("series/create/", SeriesCreateView.as_view()),
    path("series/<int:series_id>/", SeriesDetailView.as_view()),
    path("series/<int:series_id>/nav/", SeriesChapterNavView.as_view()),

    path("manga/", MangaListView.as_view()),
    path("manga/<int:manga_id>/", DeleteMangaView.as_view()),
    path("manga/<int:manga_id>/update/", MangaUpdateView.as_view()),

    path("upload/", UploadMangaView.as_view()),

    path("page/", GetPageView.as_view()),
    path("translate/", TranslatePageView.as_view()),
    path("translate/bulk/", BulkTranslateView.as_view()),

    path("progress/", UpdateProgressView.as_view()),
    path("progress/reset/", ResetProgressView.as_view()),

    path("notes/", NoteListView.as_view()),
    path("notes/create/", NoteCreateView.as_view()),
    path("notes/<int:note_id>/", NoteDeleteView.as_view()),

    path("stats/", StatsView.as_view()),
    path("stats/detailed/", DetailedStatsView.as_view()),
]