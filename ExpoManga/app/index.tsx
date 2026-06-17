import { useRouter } from 'expo-router';
import { useState, useEffect, useCallback } from 'react';
import { View, ActivityIndicator } from 'react-native';
import LibraryScreen from '../src/screens/LibraryScreen';
import SeriesScreen from '../src/screens/SeriesScreen';
import StatsScreen from '../src/screens/StatsScreen';
import AuthScreen from '../src/screens/AuthScreen';
import { getToken } from '../src/services/api';
import { Colors } from '../src/theme';

export default function Index() {
  const router = useRouter();
  const [currentScreen, setCurrentScreen] = useState('Library');
  const [screenParams, setScreenParams] = useState(null);
  const [authChecked, setAuthChecked] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  const checkAuth = useCallback(async () => {
    const token = await getToken();
    setIsAuthenticated(!!token);
    setAuthChecked(true);
  }, []);

  useEffect(() => {
    checkAuth();
  }, [checkAuth]);

  const navigateToViewer = useCallback((params) => {
    router.push({
      pathname: '/viewer',
      params: {
        manga_id: String(params.manga_id),
        totalPages: String(params.totalPages),
        title: params.title,
        last_page: String(params.last_page ?? 0),
        series_id: params.series_id ? String(params.series_id) : '',
      },
    });
  }, [router]);

  const navigation = {
    navigate: (screen, params) => {
      if (screen === 'Viewer') {
        navigateToViewer(params);
      } else if (screen === 'Series') {
        setScreenParams(params);
        setCurrentScreen('Series');
      } else if (screen === 'Stats') {
        setCurrentScreen('Stats');
        setScreenParams(null);
      } else if (screen === 'Library') {
        setCurrentScreen('Library');
        setScreenParams(null);
      }
    },
    goBack: () => {
      setCurrentScreen('Library');
      setScreenParams(null);
    },
  };

  const seriesNavigation = {
    ...navigation,
    goBack: () => { setCurrentScreen('Library'); setScreenParams(null); },
    navigate: (screen, params) => {
      if (screen === 'Viewer') navigateToViewer(params);
    },
    replace: (screen, params) => {
      if (screen === 'Viewer') navigateToViewer(params);
    },
  };

  const statsNavigation = {
    goBack: () => { setCurrentScreen('Library'); setScreenParams(null); },
  };

  const handleSignedOut = useCallback(() => {
    setIsAuthenticated(false);
    setCurrentScreen('Library');
    setScreenParams(null);
  }, []);

  const handleAuthenticated = useCallback(() => {
    setIsAuthenticated(true);
  }, []);

  // Single return path — always renders the same outer structure,
  // swapping only the inner content. This avoids hook-order mismatches
  // that Expo Router's ContextNavigator is sensitive to.
  let content;

  if (!authChecked) {
    content = (
      <View style={{ flex: 1, backgroundColor: Colors.bg, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator size="large" color={Colors.accent} />
      </View>
    );
  } else if (!isAuthenticated) {
    content = <AuthScreen onAuthenticated={handleAuthenticated} />;
  } else if (currentScreen === 'Stats') {
    content = <StatsScreen navigation={statsNavigation} />;
  } else if (currentScreen === 'Series' && screenParams) {
    content = <SeriesScreen route={{ params: screenParams }} navigation={seriesNavigation} />;
  } else {
    content = <LibraryScreen navigation={navigation} onSignedOut={handleSignedOut} />;
  }

  return content;
}