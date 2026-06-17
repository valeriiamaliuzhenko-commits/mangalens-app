from django.db import migrations, models
import django.db.models.deletion
from django.contrib.auth.hashers import make_password  # <-- Added this import


def assign_to_admin(apps, schema_editor):
    User = apps.get_model('auth', 'User')
    Series = apps.get_model('manga_api', 'Series')
    Manga = apps.get_model('manga_api', 'Manga')

    # Create admin user if it doesn't exist
    admin, created = User.objects.get_or_create(
        username='admin',
        defaults={
            'is_staff': True, 
            'is_superuser': True,
            'password': make_password('admin')  # <-- Sets password cleanly inside migrations
        }
    )

    # Assign all existing data to admin
    Series.objects.filter(user__isnull=True).update(user=admin)
    Manga.objects.filter(user__isnull=True).update(user=admin)


class Migration(migrations.Migration):

    dependencies = [
        ('manga_api', '0005_manga_rating_series_rating'),
        ('auth', '0012_alter_user_first_name_max_length'),
    ]

    operations = [
        # Add user to Series
        migrations.AddField(
            model_name='series',
            name='user',
            field=models.ForeignKey(
                blank=True, null=True,
                on_delete=django.db.models.deletion.CASCADE,
                related_name='series',
                to='auth.user',
            ),
        ),
        # Add user to Manga
        migrations.AddField(
            model_name='manga',
            name='user',
            field=models.ForeignKey(
                blank=True, null=True,
                on_delete=django.db.models.deletion.CASCADE,
                related_name='manga',
                to='auth.user',
            ),
        ),
        # Assign existing data to admin
        migrations.RunPython(assign_to_admin, migrations.RunPython.noop),
    ]