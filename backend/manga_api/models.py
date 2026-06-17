from django.db import models
from django.contrib.auth.models import User

STATUS_CHOICES = [
    ('planned', 'Planned'),
    ('in_progress', 'In Progress'),
    ('done', 'Done'),
    ('dropped', 'Dropped'),
]


class Series(models.Model):
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='series', null=True, blank=True)
    title = models.CharField(max_length=255)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='planned')
    rating = models.IntegerField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return self.title

    @property
    def cover(self):
        first = self.chapters.order_by('chapter_order').first()
        return first.cover if first else None

    @property
    def total_pages(self):
        return sum(m.total_pages for m in self.chapters.all())

    @property
    def total_chapters(self):
        return self.chapters.count()


class Manga(models.Model):
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='manga', null=True, blank=True)
    series = models.ForeignKey(
        Series, on_delete=models.CASCADE,
        related_name='chapters', null=True, blank=True
    )
    chapter_order = models.IntegerField(default=0)
    title = models.CharField(max_length=255)
    file_name = models.CharField(max_length=255)
    total_pages = models.IntegerField(default=0)
    cover = models.TextField(blank=True, null=True)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='planned')
    rating = models.IntegerField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['chapter_order', '-created_at']

    def __str__(self):
        return self.title


class Page(models.Model):
    manga = models.ForeignKey(Manga, on_delete=models.CASCADE, related_name='pages')
    page_number = models.IntegerField()
    image_data = models.TextField()
    translation = models.TextField(blank=True, null=True)
    translated_at = models.DateField(blank=True, null=True)

    class Meta:
        unique_together = ('manga', 'page_number')
        ordering = ['page_number']

    def __str__(self):
        return f"{self.manga.title} - Page {self.page_number}"


class ReadingProgress(models.Model):
    manga = models.OneToOneField(Manga, on_delete=models.CASCADE, related_name='progress')
    last_page = models.IntegerField(default=0)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"{self.manga.title} - Page {self.last_page}"


class ReadingHistory(models.Model):
    manga = models.ForeignKey(Manga, on_delete=models.CASCADE, related_name='history')
    date = models.DateField()
    pages_read = models.IntegerField(default=0)

    class Meta:
        unique_together = ('manga', 'date')
        ordering = ['date']

    def __str__(self):
        return f"{self.manga.title} - {self.date} - {self.pages_read} pages"


class Note(models.Model):
    manga = models.ForeignKey(Manga, on_delete=models.CASCADE, related_name='notes')
    page_number = models.IntegerField()
    text = models.TextField()
    x = models.FloatField()
    y = models.FloatField()
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['page_number', 'created_at']

    def __str__(self):
        return f"{self.manga.title} - Page {self.page_number} note"