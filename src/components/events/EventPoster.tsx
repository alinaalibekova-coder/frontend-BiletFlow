import { useEffect, useState } from "react";
import { getEventPoster } from "../../api/events";
import { useLanguage } from "../../i18n/LanguageContext";
import { posterUrlThroughProxy } from "../../lib/posterUrl";
import { Icon, categoryIcon } from "../ui/Icons";
import { categoryKey } from "../../lib/format";

// Fallback art when there is no poster: a deep colour block per category with its icon.
const FALLBACK_TONES = [
  "from-primary-dark to-primary", "from-[#1d4f91] to-[#3b7dd8]", "from-[#7a2e5c] to-[#c2477f]",
  "from-[#0f5c4d] to-[#1f9a7d]", "from-[#7a4300] to-[#c77a12]", "from-ink to-[#4a3f8f]",
];
const toneFor = (category: string) => FALLBACK_TONES[[...categoryKey(category)].reduce((sum, char) => sum + char.charCodeAt(0), 0) % FALLBACK_TONES.length];

export function EventPoster({
  posterUrl,
  authenticated = false,
  className,
  alt,
  category,
  imgClassName = "",
}: {
  posterUrl?: string | null;
  authenticated?: boolean;
  className: string;
  alt?: string;
  // Enables the category fallback art; without it the neutral placeholder text is shown.
  category?: string;
  imgClassName?: string;
}) {
  const { t } = useLanguage();
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    setFailed(false);
    if (!posterUrl) {
      setImageUrl(null);
      return;
    }
    if (!authenticated) {
      setImageUrl(posterUrlThroughProxy(posterUrl));
      return;
    }

    let cancelled = false;
    let objectUrl: string | null = null;
    setImageUrl(null);
    void getEventPoster(posterUrlThroughProxy(posterUrl))
      .then((blob) => {
        if (cancelled) return;
        objectUrl = URL.createObjectURL(blob);
        setImageUrl(objectUrl);
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      });

    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [posterUrl, authenticated]);

  return (
    <div className={`relative flex items-center justify-center overflow-hidden bg-surface text-center text-muted ${className}`}>
      {imageUrl && !failed ? (
        <img
          src={imageUrl}
          alt={alt ?? t("eventPoster")}
          className={`absolute inset-0 h-full w-full object-cover ${imgClassName}`}
          onError={() => setFailed(true)}
        />
      ) : category ? (
        <div data-poster-fallback="true" className={`absolute inset-0 flex items-center justify-center bg-linear-to-br text-white/90 ${toneFor(category)}`}>
          <svg aria-hidden="true" className="absolute inset-0 h-full w-full opacity-15" preserveAspectRatio="none" viewBox="0 0 100 100"><circle cx="85" cy="15" r="30" fill="white" /><circle cx="10" cy="95" r="22" fill="white" /></svg>
          <Icon name={categoryIcon(category)} className="relative h-1/3 max-h-20 w-1/3 max-w-20" strokeWidth={1.4} />
          {failed && <span className="absolute bottom-2 left-2 right-2 rounded bg-ink/70 px-2 py-1 text-xs">{t("posterFailed")}</span>}
        </div>
      ) : (
        <span className="px-3 text-sm">{failed ? t("posterFailed") : t("poster")}</span>
      )}
    </div>
  );
}
