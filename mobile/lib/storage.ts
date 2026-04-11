import AsyncStorage from '@react-native-async-storage/async-storage';

const LANGUAGE_KEY = 'app_language';

export async function getLanguage(): Promise<string> {
  return (await AsyncStorage.getItem(LANGUAGE_KEY)) ?? 'en';
}

export async function setLanguage(lang: string): Promise<void> {
  await AsyncStorage.setItem(LANGUAGE_KEY, lang);
}
