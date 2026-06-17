import { useLocalSearchParams, useRouter } from 'expo-router';
import ViewerScreen from '../src/screens/ViewerScreen';

export default function Viewer() {
  const params = useLocalSearchParams();
  const router = useRouter();

  const route = {
    params: {
      manga_id: params.manga_id,
      totalPages: Number(params.totalPages),
      title: params.title,
      last_page: Number(params.last_page ?? 0),
      series_id: params.series_id && params.series_id !== '' ? Number(params.series_id) : null,
    },
  };

  const navigation = {
    goBack: () => router.back(),
    replace: (screen, p) => {
      if (screen === 'Viewer') {
        router.replace({
          pathname: '/viewer',
          params: {
            manga_id: String(p.manga_id),
            totalPages: String(p.totalPages),
            title: p.title,
            last_page: String(p.last_page ?? 0),
            series_id: p.series_id ? String(p.series_id) : '',
          },
        });
      }
    },
  };

  return <ViewerScreen route={route} navigation={navigation} />;
}