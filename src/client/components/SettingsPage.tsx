import { useEffect, useState } from 'react';
import { api, ApiError } from '../api';
import { useApp } from '../app-context';
import { SettingsPanel } from './SettingsPanel';

const MIN = 1;
const MAX = 200;
const RANGE_MESSAGE = `Enter a whole number from ${MIN} to ${MAX}.`;

/** The Settings tab: loads the settings and saves the number of questions per round. */
export function SettingsPage() {
  const { session, setSession, handleApiError } = useApp();
  const [value, setValue] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let alive = true;
    api
      .getSettings()
      .then((settings) => alive && setValue(String(settings.questionsPerRound)))
      .catch((failure: unknown) => alive && handleApiError(failure));
    return () => {
      alive = false;
    };
  }, [handleApiError]);

  const save = async () => {
    if (value === null || saving) return;
    const text = value.trim();
    const number = Number(text);
    if (!/^\d+$/.test(text) || number < MIN || number > MAX) {
      setSaved(false);
      setError(RANGE_MESSAGE);
      return;
    }
    setSaving(true);
    try {
      const settings = await api.putSettings(number);
      setValue(String(settings.questionsPerRound));
      setSession({ ...session, questionsPerRound: settings.questionsPerRound });
      setError(null);
      setSaved(true);
    } catch (failure) {
      if (failure instanceof ApiError && failure.code === 'INVALID_SETTING') {
        setSaved(false);
        setError(failure.message || RANGE_MESSAGE);
      } else {
        handleApiError(failure);
      }
    } finally {
      setSaving(false);
    }
  };

  if (value === null) return null;
  return (
    <SettingsPanel
      value={value}
      error={error}
      saved={saved}
      saving={saving}
      onChange={(next) => {
        setValue(next);
        setError(null);
        setSaved(false);
      }}
      onSave={() => void save()}
    />
  );
}
