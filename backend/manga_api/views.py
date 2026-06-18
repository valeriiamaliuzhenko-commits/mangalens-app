import io
import os
import base64
import threading
import random
from PIL import Image
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.parsers import MultiPartParser
from rest_framework import status
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.authtoken.models import Token
from django.contrib.auth import authenticate
from django.contrib.auth.models import User
from django.db.models import Sum, F, Count, Q
from django.utils.timezone import now
from datetime import date, timedelta

from .gemini_service import translate_page_with_gemini
from .models import Manga, Page, ReadingProgress, Note, Series, ReadingHistory

STATUS_CHOICES = ['planned', 'in_progress', 'done', 'dropped']

MILESTONES = [
    {"id": "first_page",  "icon": "📖", "title": "First Page",       "desc": "Read your first page",       "type": "read",      "target": 1},
    {"id": "bookworm",    "icon": "📚", "title": "Bookworm",         "desc": "Read 50 pages",              "type": "read",      "target": 50},
    {"id": "on_fire",     "icon": "🔥", "title": "On Fire",          "desc": "Read 100 pages",             "type": "read",      "target": 100},
    {"id": "dedicated",   "icon": "💫", "title": "Dedicated",        "desc": "Read 500 pages",             "type": "read",      "target": 500},
    {"id": "legend",      "icon": "🌟", "title": "Legend",           "desc": "Read 1000 pages",            "type": "read",      "target": 1000},
    {"id": "first_trans", "icon": "⚡", "title": "First Translation", "desc": "Translate your first page", "type": "translate", "target": 1},
    {"id": "ai_scholar",  "icon": "🤖", "title": "AI Scholar",       "desc": "Translate 50 pages",         "type": "translate", "target": 50},
    {"id": "translator",  "icon": "🧠", "title": "Translator",       "desc": "Translate 200 pages",        "type": "translate", "target": 200},
    {"id": "collector",   "icon": "📦", "title": "Collector",        "desc": "Add 5 manga",                "type": "manga",     "target": 5},
    {"id": "archivist",   "icon": "🏆", "title": "Archivist",        "desc": "Add 20 manga",               "type": "manga",     "target": 20},
]


def pil_to_base64(img: Image.Image) -> str:
    buffer = io.BytesIO()
    if img.mode in ("RGBA", "P", "LA"):
        img = img.convert("RGB")
    img.save(buffer, format="JPEG", quality=80)
    buffer.seek(0)
    return base64.b64encode(buffer.read()).decode("utf-8")


def manga_to_dict(manga):
    progress = getattr(manga, 'progress', None)
    last_page = progress.last_page if progress else 0
    has_history = manga.history.exists()
    pages_read = (last_page + 1) if has_history else 0
    is_fully_read = manga.total_pages > 0 and last_page >= manga.total_pages - 1 and has_history
    return {
        "id": manga.id,
        "title": manga.title,
        "file_name": manga.file_name,
        "total_pages": manga.total_pages,
        "last_page": last_page,
        "pages_read": pages_read,
        "cover": manga.display_cover,
        "custom_cover": bool(manga.custom_cover),
        "status": manga.status,
        "rating": manga.rating,
        "chapter_order": manga.chapter_order,
        "series_id": manga.series_id,
        "is_fully_read": is_fully_read,
        "created_at": manga.created_at.isoformat(),
    }


def log_reading_history(manga_id, pages_read):
    today = date.today()
    obj, created = ReadingHistory.objects.get_or_create(
        manga_id=manga_id, date=today,
        defaults={'pages_read': pages_read}
    )
    if not created and pages_read > obj.pages_read:
        obj.pages_read = pages_read
        obj.save()


# ─── Auth ─────────────────────────────────────────────────────────────────────

class RegisterView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        username = request.data.get('username', '').strip()
        password = request.data.get('password', '')

        if not username or not password:
            return Response({'error': 'Username and password required.'}, status=status.HTTP_400_BAD_REQUEST)
        if len(password) < 4:
            return Response({'error': 'Password must be at least 4 characters.'}, status=status.HTTP_400_BAD_REQUEST)
        if User.objects.filter(username=username).exists():
            return Response({'error': 'Username already taken.'}, status=status.HTTP_400_BAD_REQUEST)

        user = User.objects.create_user(username=username, password=password)
        token, _ = Token.objects.get_or_create(user=user)
        return Response({'token': token.key, 'username': user.username}, status=status.HTTP_201_CREATED)


class LoginView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        username = request.data.get('username', '').strip()
        password = request.data.get('password', '')
        user = authenticate(username=username, password=password)
        if not user:
            return Response({'error': 'Invalid username or password.'}, status=status.HTTP_401_UNAUTHORIZED)
        token, _ = Token.objects.get_or_create(user=user)
        return Response({'token': token.key, 'username': user.username})


class LogoutView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        request.user.auth_token.delete()
        return Response({'status': 'logged out'})


class DeleteAccountView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        password = request.data.get('password', '')
        if not authenticate(username=request.user.username, password=password):
            return Response({'error': 'Incorrect password.'}, status=status.HTTP_401_UNAUTHORIZED)
        request.user.delete()
        return Response({'status': 'account deleted'})


# ─── Health ───────────────────────────────────────────────────────────────────

class HealthCheckView(APIView):
    permission_classes = [AllowAny]

    def get(self, request):
        return Response({"status": "ok", "gemini_configured": bool(os.getenv("GEMINI_API_KEY"))})


# ─── Series ───────────────────────────────────────────────────────────────────

class SeriesListView(APIView):
    def get(self, request):
        series_qs = Series.objects.filter(user=request.user).prefetch_related('chapters__progress').all()
        data = []
        for s in series_qs:
            chapters = list(s.chapters.all())
            total_read = sum(
                (getattr(c, 'progress', None).last_page + 1 if getattr(c, 'progress', None) and c.history.exists() else 0)
                for c in chapters
            )
            total_pages = sum(c.total_pages for c in chapters)
            data.append({
                "id": s.id, "title": s.title, "status": s.status, "rating": s.rating,
                "total_chapters": len(chapters), "total_pages": total_pages,
                "total_read": total_read, "cover": s.cover,
                "custom_cover": bool(s.custom_cover),
                "created_at": s.created_at.isoformat(),
            })
        return Response(data)


class SeriesCreateView(APIView):
    def post(self, request):
        title = request.data.get("title", "").strip()
        if not title:
            return Response({"error": "Title required."}, status=status.HTTP_400_BAD_REQUEST)
        s = Series.objects.create(
            user=request.user,
            title=title,
            status=request.data.get("status", "planned")
        )
        return Response({"id": s.id, "title": s.title, "status": s.status, "rating": s.rating}, status=status.HTTP_201_CREATED)


class SeriesDetailView(APIView):
    def get_series(self, request, series_id):
        try:
            return Series.objects.prefetch_related('chapters__progress').get(id=series_id, user=request.user)
        except Series.DoesNotExist:
            return None

    def get(self, request, series_id):
        s = self.get_series(request, series_id)
        if not s:
            return Response({"error": "Not found."}, status=status.HTTP_404_NOT_FOUND)
        chapters = [manga_to_dict(c) for c in s.chapters.all()]
        return Response({
            "id": s.id, "title": s.title, "status": s.status, "rating": s.rating,
            "total_chapters": len(chapters), "cover": s.cover,
            "custom_cover": bool(s.custom_cover),
            "created_at": s.created_at.isoformat(), "chapters": chapters,
        })

    def patch(self, request, series_id):
        s = self.get_series(request, series_id)
        if not s:
            return Response({"error": "Not found."}, status=status.HTTP_404_NOT_FOUND)
        if "title" in request.data:
            s.title = request.data["title"].strip() or s.title
        if "status" in request.data and request.data["status"] in STATUS_CHOICES:
            s.status = request.data["status"]
        if "rating" in request.data:
            r = request.data["rating"]
            s.rating = int(r) if r is not None and 1 <= int(r) <= 5 else None
        s.save()
        return Response({"id": s.id, "title": s.title, "status": s.status, "rating": s.rating})

    def delete(self, request, series_id):
        s = self.get_series(request, series_id)
        if not s:
            return Response({"error": "Not found."}, status=status.HTTP_404_NOT_FOUND)
        s.delete()
        return Response({"status": "deleted"})


class SeriesChapterNavView(APIView):
    def get(self, request, series_id):
        mode = request.query_params.get("mode", "next")
        current_manga_id = request.query_params.get("current_manga_id")
        try:
            s = Series.objects.prefetch_related('chapters__progress').get(id=series_id, user=request.user)
        except Series.DoesNotExist:
            return Response({"error": "Not found."}, status=status.HTTP_404_NOT_FOUND)

        chapters = list(s.chapters.order_by('chapter_order'))
        if not chapters:
            return Response({"error": "No chapters."}, status=status.HTTP_404_NOT_FOUND)

        if mode == "random":
            others = [c for c in chapters if str(c.id) != str(current_manga_id)]
            chapter = random.choice(others) if others else chapters[0]
        else:
            current_idx = next((i for i, c in enumerate(chapters) if str(c.id) == str(current_manga_id)), -1)
            if current_idx == -1 or current_idx >= len(chapters) - 1:
                return Response({"error": "No next chapter."}, status=status.HTTP_404_NOT_FOUND)
            chapter = chapters[current_idx + 1]

        progress = getattr(chapter, 'progress', None)
        return Response({
            "manga_id": chapter.id,
            "title": chapter.title,
            "total_pages": chapter.total_pages,
            "last_page": progress.last_page if progress else 0,
        })


# ─── Manga ────────────────────────────────────────────────────────────────────

class MangaListView(APIView):
    def get(self, request):
        series_id = request.query_params.get("series_id")
        qs = Manga.objects.filter(user=request.user).select_related('progress').all()
        if series_id:
            qs = qs.filter(series_id=series_id)
        else:
            qs = qs.filter(series__isnull=True)
        return Response([manga_to_dict(m) for m in qs.order_by('-created_at')])


class MangaUpdateView(APIView):
    def patch(self, request, manga_id):
        try:
            manga = Manga.objects.get(id=manga_id, user=request.user)
        except Manga.DoesNotExist:
            return Response({"error": "Not found."}, status=status.HTTP_404_NOT_FOUND)
        if "title" in request.data:
            manga.title = request.data["title"].strip() or manga.title
        if "status" in request.data and request.data["status"] in STATUS_CHOICES:
            manga.status = request.data["status"]
        if "chapter_order" in request.data:
            manga.chapter_order = int(request.data["chapter_order"])
        if "rating" in request.data:
            r = request.data["rating"]
            manga.rating = int(r) if r is not None and 1 <= int(r) <= 5 else None
        manga.save()
        return Response(manga_to_dict(manga))

class SetMangaCoverView(APIView):
    """POST /api/manga/<id>/cover/
    Body: { "page_number": N } to use an existing page as cover
       OR { "image_data": "<base64>" } to use an uploaded image
    """
    def post(self, request, manga_id):
        try:
            manga = Manga.objects.get(id=manga_id, user=request.user)
        except Manga.DoesNotExist:
            return Response({"error": "Not found."}, status=status.HTTP_404_NOT_FOUND)
 
        if "page_number" in request.data:
            page_num = int(request.data["page_number"])
            try:
                page = Page.objects.get(manga=manga, page_number=page_num)
            except Page.DoesNotExist:
                return Response({"error": "Page not found."}, status=status.HTTP_404_NOT_FOUND)
            manga.custom_cover = page.image_data
        elif "image_data" in request.data:
            manga.custom_cover = request.data["image_data"]
        else:
            return Response({"error": "page_number or image_data required."}, status=status.HTTP_400_BAD_REQUEST)
 
        manga.save()
        return Response({"id": manga.id, "cover": manga.display_cover})
 
    def delete(self, request, manga_id):
        """Revert to default (first-page) cover"""
        try:
            manga = Manga.objects.get(id=manga_id, user=request.user)
        except Manga.DoesNotExist:
            return Response({"error": "Not found."}, status=status.HTTP_404_NOT_FOUND)
        manga.custom_cover = None
        manga.save()
        return Response({"id": manga.id, "cover": manga.display_cover})
 
 
class SetSeriesCoverView(APIView):
    """POST /api/series/<id>/cover/
    Body: { "image_data": "<base64>" } — series has no own pages, gallery only
    """
    def post(self, request, series_id):
        try:
            series = Series.objects.get(id=series_id, user=request.user)
        except Series.DoesNotExist:
            return Response({"error": "Not found."}, status=status.HTTP_404_NOT_FOUND)
 
        if "image_data" not in request.data:
            return Response({"error": "image_data required."}, status=status.HTTP_400_BAD_REQUEST)
 
        series.custom_cover = request.data["image_data"]
        series.save()
        return Response({"id": series.id, "cover": series.cover})
 
    def delete(self, request, series_id):
        """Revert to default (first chapter's cover)"""
        try:
            series = Series.objects.get(id=series_id, user=request.user)
        except Series.DoesNotExist:
            return Response({"error": "Not found."}, status=status.HTTP_404_NOT_FOUND)
        series.custom_cover = None
        series.save()
        return Response({"id": series.id, "cover": series.cover})

class UploadMangaView(APIView):
    parser_classes = [MultiPartParser]

    def post(self, request):
        file_obj = request.FILES.get("file")
        if not file_obj:
            return Response({"error": "No file provided."}, status=status.HTTP_400_BAD_REQUEST)

        file_name = file_obj.name
        series_id = request.data.get("series_id")
        chapter_order = int(request.data.get("chapter_order", 0))
        images = []

        try:
            if file_name.lower().endswith(".pdf"):
                from pdf2image import convert_from_bytes
                images = convert_from_bytes(
                file_obj.read(), dpi=100, size=(800, None)
            )
            elif any(file_name.lower().endswith(ext) for ext in [".jpg", ".jpeg", ".png", ".webp"]):
                images = [Image.open(file_obj)]
            else:
                return Response({"error": "Unsupported file type."}, status=status.HTTP_415_UNSUPPORTED_MEDIA_TYPE)
        except Exception as e:
            print(f"ERROR DURING FILE PROCESSING: {str(e)}")
            return Response({"error": str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

        title = os.path.splitext(file_name)[0]
        cover_b64 = pil_to_base64(images[0]) if images else None

        series = None
        if series_id:
            try:
                series = Series.objects.get(id=series_id, user=request.user)
                if not request.data.get("chapter_order"):
                    chapter_order = series.chapters.count()
            except Series.DoesNotExist:
                pass

        manga = Manga.objects.create(
            user=request.user,
            title=title, file_name=file_name, total_pages=len(images),
            cover=cover_b64, series=series, chapter_order=chapter_order,
            status='in_progress' if series else 'planned',
        )

        for i, img in enumerate(images):
            Page.objects.create(manga=manga, page_number=i, image_data=pil_to_base64(img))

        ReadingProgress.objects.create(manga=manga, last_page=0)

        return Response({
            "manga_id": manga.id, "title": manga.title,
            "total_pages": manga.total_pages, "series_id": manga.series_id,
        }, status=status.HTTP_201_CREATED)


class GetPageView(APIView):
    def get(self, request):
        manga_id = request.query_params.get("manga_id")
        page_num = int(request.query_params.get("page", 0))
        try:
            page = Page.objects.get(manga_id=manga_id, manga__user=request.user, page_number=page_num)
        except Page.DoesNotExist:
            return Response({"error": "Page not found."}, status=status.HTTP_404_NOT_FOUND)
        return Response({"page_b64": page.image_data, "translation": page.translation or ""})


class TranslatePageView(APIView):
    def post(self, request):
        manga_id = request.data.get("manga_id")
        page_num = int(request.data.get("page", 0))
        try:
            page = Page.objects.get(manga_id=manga_id, manga__user=request.user, page_number=page_num)
        except Page.DoesNotExist:
            return Response({"error": "Page not found."}, status=status.HTTP_404_NOT_FOUND)

        image_bytes = base64.b64decode(page.image_data)
        translation = translate_page_with_gemini(image_bytes, mime_type="image/jpeg")

        if translation.startswith("Translation error:") or "429" in translation or "Error" in translation:
            return Response(
                {"error": "Translation service unavailable. Please try again later."},
                status=status.HTTP_503_SERVICE_UNAVAILABLE
            )

        page.translation = translation
        page.translated_at = now().date()
        page.save()
        return Response({"translation": translation})


class BulkTranslateView(APIView):
    _jobs = {}
    _lock = threading.Lock()

    def post(self, request):
        manga_id = request.data.get("manga_id")
        if not manga_id:
            return Response({"error": "manga_id required."}, status=status.HTTP_400_BAD_REQUEST)

        try:
            manga = Manga.objects.get(id=manga_id, user=request.user)
        except Manga.DoesNotExist:
            return Response({"error": "Manga not found."}, status=status.HTTP_404_NOT_FOUND)

        with self._lock:
            job = self._jobs.get(manga_id)
            if job and job.get("running"):
                return Response({"status": "already_running", **job})

        untranslated = Page.objects.filter(manga_id=manga_id).filter(
            Q(translation__isnull=True) | Q(translation='')
        )
        total = untranslated.count()

        if total == 0:
            return Response({"status": "nothing_to_translate", "total": 0, "done": 0})

        job_state = {"total": total, "done": 0, "failed": 0, "running": True}
        with self._lock:
            self._jobs[str(manga_id)] = job_state

        def run():
            pages = list(Page.objects.filter(manga_id=manga_id).filter(
                Q(translation__isnull=True) | Q(translation='')
            ).order_by('page_number'))

            for page in pages:
                try:
                    image_bytes = base64.b64decode(page.image_data)
                    translation = translate_page_with_gemini(image_bytes, mime_type="image/jpeg")
                    if translation.startswith("Translation error:") or "Error" in translation:
                        print(f"BULK TRANSLATION FAILED page {page.page_number}: {translation[:100]}")
                        with BulkTranslateView._lock:
                            BulkTranslateView._jobs[str(manga_id)]["failed"] += 1
                    else:
                        page.translation = translation
                        page.translated_at = date.today()
                        page.save()
                        with BulkTranslateView._lock:
                            BulkTranslateView._jobs[str(manga_id)]["done"] += 1
                except Exception as e:
                    print(f"BULK ERROR page {page.page_number}: {e}")
                    with BulkTranslateView._lock:
                        BulkTranslateView._jobs[str(manga_id)]["failed"] += 1

            with BulkTranslateView._lock:
                BulkTranslateView._jobs[str(manga_id)]["running"] = False

        thread = threading.Thread(target=run, daemon=True)
        thread.start()
        return Response({"status": "started", "total": total, "done": 0})

    def get(self, request):
        manga_id = str(request.query_params.get("manga_id", ""))
        with self._lock:
            job = self._jobs.get(manga_id)
        if not job:
            return Response({"status": "not_started"})
        return Response({"status": "running" if job["running"] else "done", **job})


# ─── Progress ─────────────────────────────────────────────────────────────────

class UpdateProgressView(APIView):
    def post(self, request):
        manga_id = request.data.get("manga_id")
        last_page = int(request.data.get("last_page", 0))
        try:
            progress = ReadingProgress.objects.get(manga_id=manga_id, manga__user=request.user)
            progress.last_page = last_page
            progress.save()
            log_reading_history(manga_id, last_page + 1)
        except ReadingProgress.DoesNotExist:
            return Response({"error": "Manga not found."}, status=status.HTTP_404_NOT_FOUND)
        return Response({"status": "ok"})


class ResetProgressView(APIView):
    def post(self, request):
        manga_id = request.data.get("manga_id")
        mark_read = request.data.get("mark_read", False)
        try:
            progress = ReadingProgress.objects.get(manga_id=manga_id, manga__user=request.user)
            manga = progress.manga
        except ReadingProgress.DoesNotExist:
            return Response({"error": "Manga not found."}, status=status.HTTP_404_NOT_FOUND)

        if mark_read:
            last = manga.total_pages - 1 if manga.total_pages > 0 else 0
            progress.last_page = last
            progress.save()
            log_reading_history(manga_id, manga.total_pages)
        else:
            progress.last_page = 0
            progress.save()
            ReadingHistory.objects.filter(manga_id=manga_id).delete()

        return Response({"status": "ok", "last_page": progress.last_page})


# ─── Delete ───────────────────────────────────────────────────────────────────

class DeleteMangaView(APIView):
    def delete(self, request, manga_id):
        try:
            Manga.objects.get(id=manga_id, user=request.user).delete()
            return Response({"status": "deleted"})
        except Manga.DoesNotExist:
            return Response({"error": "Not found."}, status=status.HTTP_404_NOT_FOUND)


# ─── Notes ────────────────────────────────────────────────────────────────────

class NoteListView(APIView):
    def get(self, request):
        manga_id = request.query_params.get("manga_id")
        page_num = request.query_params.get("page")
        notes = Note.objects.filter(manga_id=manga_id, manga__user=request.user)
        if page_num is not None:
            notes = notes.filter(page_number=int(page_num))
        return Response([{
            "id": n.id, "page_number": n.page_number,
            "text": n.text, "x": n.x, "y": n.y,
            "created_at": n.created_at.isoformat(),
        } for n in notes])


class NoteCreateView(APIView):
    def post(self, request):
        manga_id = request.data.get("manga_id")
        try:
            manga = Manga.objects.get(id=manga_id, user=request.user)
        except Manga.DoesNotExist:
            return Response({"error": "Manga not found."}, status=status.HTTP_404_NOT_FOUND)
        note = Note.objects.create(
            manga=manga,
            page_number=request.data.get("page_number"),
            text=request.data.get("text", ""),
            x=request.data.get("x", 0.5),
            y=request.data.get("y", 0.5),
        )
        return Response({
            "id": note.id, "page_number": note.page_number,
            "text": note.text, "x": note.x, "y": note.y,
            "created_at": note.created_at.isoformat(),
        }, status=status.HTTP_201_CREATED)


class NoteDeleteView(APIView):
    def delete(self, request, note_id):
        try:
            Note.objects.get(id=note_id, manga__user=request.user).delete()
            return Response({"status": "deleted"})
        except Note.DoesNotExist:
            return Response({"error": "Not found."}, status=status.HTTP_404_NOT_FOUND)


# ─── Stats ────────────────────────────────────────────────────────────────────

class StatsView(APIView):
    def get(self, request):
        u = request.user
        pages_read = sum(
            (p.last_page + 1) for p in ReadingProgress.objects.filter(manga__user=u)
            if p.manga.history.exists()
        )

        translated = Page.objects.filter(
            manga__user=u, translation__isnull=False
        ).exclude(translation='').count()

        top_standalone = ReadingProgress.objects.select_related('manga').filter(
            manga__user=u, manga__series__isnull=True
        ).order_by('-last_page').first()

        top_series = None
        top_series_read = 0
        for s in Series.objects.filter(user=u).prefetch_related('chapters__progress').all():
            total_read = sum(
                (getattr(c, 'progress', None).last_page + 1 if getattr(c, 'progress', None) and c.history.exists() else 0)
                for c in s.chapters.all()
            )
            if total_read > top_series_read:
                top_series_read = total_read
                top_series = s

        most_read = None
        standalone_read = (top_standalone.last_page + 1) if top_standalone else 0

        if top_series and top_series_read > standalone_read:
            most_read = {
                "id": top_series.id, "title": top_series.title,
                "last_page": top_series_read,
                "total_pages": sum(c.total_pages for c in top_series.chapters.all()),
                "cover": top_series.cover, "is_series": True,
            }
        elif top_standalone and standalone_read > 0:
            most_read = {
                "id": top_standalone.manga.id, "title": top_standalone.manga.title,
                "last_page": standalone_read, "total_pages": top_standalone.manga.total_pages,
                "cover": top_standalone.manga.display_cover, "is_series": False,
            }

        return Response({
            "pages_read": pages_read,
            "translated_pages": translated,
            "most_read": most_read,
        })


class DetailedStatsView(APIView):
    def get(self, request):
        u = request.user
        range_param = request.query_params.get("range", "week")
        today = date.today()

        if range_param == "week":
            start_date = today - timedelta(days=6)
        elif range_param == "prev_week":
            start_date = today - timedelta(days=13)
            today = today - timedelta(days=7)
        elif range_param == "month":
            start_date = today - timedelta(days=29)
        else:
            first_history = ReadingHistory.objects.filter(manga__user=u).order_by('date').first()
            start_date = first_history.date if first_history else today

        status_counts = {}
        for m in Manga.objects.filter(user=u, series__isnull=True):
            status_counts[m.status] = status_counts.get(m.status, 0) + 1
        for s in Series.objects.filter(user=u):
            status_counts[s.status] = status_counts.get(s.status, 0) + 1

        star_counts = {"1": 0, "2": 0, "3": 0, "4": 0, "5": 0, "unrated": 0}
        for m in Manga.objects.filter(user=u, series__isnull=True):
            if m.rating:
                star_counts[str(m.rating)] += 1
            else:
                star_counts["unrated"] += 1
        for s in Series.objects.filter(user=u):
            if s.rating:
                star_counts[str(s.rating)] += 1
            else:
                star_counts["unrated"] += 1

        total_pages = Page.objects.filter(manga__user=u).count()
        translated_pages = Page.objects.filter(
            manga__user=u, translation__isnull=False
        ).exclude(translation='').count()

        history_qs = ReadingHistory.objects.filter(
            manga__user=u, date__gte=start_date, date__lte=today
        ).values('date').annotate(total=Sum('pages_read')).order_by('date')

        history_map = {h['date'].isoformat(): h['total'] for h in history_qs}
        reading_by_day = []
        current = start_date
        while current <= today:
            reading_by_day.append({"date": current.isoformat(), "pages": history_map.get(current.isoformat(), 0)})
            current += timedelta(days=1)

        trans_qs = Page.objects.filter(
            manga__user=u,
            translated_at__gte=start_date,
            translated_at__lte=today,
            translated_at__isnull=False,
        ).values('translated_at').annotate(total=Count('id')).order_by('translated_at')

        trans_map = {t['translated_at'].isoformat(): t['total'] for t in trans_qs}
        translation_by_day = []
        current = start_date
        while current <= today:
            translation_by_day.append({"date": current.isoformat(), "pages": trans_map.get(current.isoformat(), 0)})
            current += timedelta(days=1)

        pages_read_total = sum(
            (p.last_page + 1) for p in ReadingProgress.objects.filter(manga__user=u)
            if p.manga.history.exists()
        )

        manga_count = Manga.objects.filter(user=u, series__isnull=True).count() + Series.objects.filter(user=u).count()

        milestones = []
        for m in MILESTONES:
            if m['type'] == 'read':
                value = pages_read_total
            elif m['type'] == 'translate':
                value = translated_pages
            else:
                value = manga_count
            unlocked = value >= m['target']
            milestones.append({
                **m,
                "unlocked": unlocked,
                "progress": min(100, round((value / m['target']) * 100)),
                "current": value,
            })

        return Response({
            "status_counts": status_counts,
            "star_counts": star_counts,
            "total_pages": total_pages,
            "translated_pages": translated_pages,
            "reading_by_day": reading_by_day,
            "translation_by_day": translation_by_day,
            "pages_read_total": pages_read_total,
            "manga_count": manga_count,
            "milestones": milestones,
            "range": range_param,
        })