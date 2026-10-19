import { useEffect, useRef, useState, useCallback } from 'react';
import styles from './OnboardingWizard.module.scss';

type Step = {
  targetSelector: string;
  title: string;
  description: string;
  position: 'top' | 'bottom' | 'left' | 'right';
};

// Mandatory tour: clients kept sending album picks on WhatsApp or making their own share links
// because they never noticed these features — every action of the album is shown once.
const STEPS: Step[] = [
  {
    targetSelector: '[data-onboarding="hub"]',
    title: '👋 Tot ce poți face e aici, sus',
    description: 'Înainte să vezi pozele, îți arătăm în <strong>1 minut</strong> ce poți face în album. Toate acțiunile sunt în <strong>cardurile de mai sus</strong>, le găsești oricând aici.',
    position: 'bottom',
  },
  {
    targetSelector: '[data-onboarding="hub-print"]',
    title: '🖼️ Pozele pentru albumul tipărit',
    description: 'Pozele pentru album le alegi <strong>direct aici</strong>, bifându-le. <strong>Nu ni le trimite pe WhatsApp sau prin alt link</strong> — selecția salvată aici ajunge direct la noi, fără greșeli.',
    position: 'bottom',
  },
  {
    targetSelector: '[data-onboarding="hub-share"]',
    title: '📤 Trimite poze invitaților',
    description: 'Vrei să dai nașilor sau prietenilor doar <strong>câteva poze</strong>? Le bifezi și primești <strong>un link doar cu ele</strong> — nu e nevoie de Drive, WeTransfer sau WhatsApp, și nu le dai tot albumul.',
    position: 'bottom',
  },
  {
    targetSelector: '[data-onboarding="hub-delivery"]',
    title: '📦 Adresa de livrare',
    description: 'Completează aici <strong>unde trimitem albumul tipărit și stick-ul</strong>. O poți modifica oricând.',
    position: 'bottom',
  },
  {
    targetSelector: '[data-onboarding="hub-download"]',
    title: '⬇️ Descarcă toate pozele',
    description: 'Toate pozele într-o arhivă ZIP, la <strong>calitate completă</strong>. Salvează-le în cel puțin <strong>două locuri</strong> (calculator + Google Photos/iCloud).',
    position: 'bottom',
  },
  {
    targetSelector: '[data-onboarding="hub-sent"]',
    title: '💌 Pozele trimise de voi',
    description: 'Aici vedeți <strong>cui ați trimis poze</strong>, câte deschideri a avut fiecare link și puteți opri oricând un link.',
    position: 'bottom',
  },
  {
    targetSelector: '[data-onboarding="hub-updates"]',
    title: '🔔 Noutăți & abonare',
    description: 'Abonează-te pe <strong>WhatsApp, SMS sau email</strong> și îți scriem când avem o estimare de predare sau încărcăm poze noi.',
    position: 'bottom',
  },
  {
    targetSelector: '[data-onboarding="photo"]',
    title: '👆 Acum, pozele',
    description: 'Apasă pe orice poză ca s-o vezi <strong>mărită</strong>. Navighezi cu <strong>săgețile</strong> sau cu <strong>swipe</strong> pe telefon.',
    position: 'bottom',
  },
];

type TooltipPosition = {
  top: number;
  left: number;
  arrowSide: 'top' | 'bottom' | 'left' | 'right';
};

/** Bumped when the tour changes, so everyone sees the new version once. */
export const ONBOARDING_STORAGE_KEY = 'av:onboarding:v2';
const STORAGE_KEY = ONBOARDING_STORAGE_KEY;
const TOOLTIP_WIDTH = 300;
const TOOLTIP_OFFSET = 16;

type Props = {
  forceShow?: boolean;
  onClose?: () => void;
  onStart?: () => void;
};

export default function OnboardingWizard({ forceShow, onClose, onStart }: Props) {
  const [currentStep, setCurrentStep] = useState(0);
  const [visible, setVisible] = useState(false);
  const [tooltipPosition, setTooltipPosition] = useState<TooltipPosition | null>(null);
  const [highlightRect, setHighlightRect] = useState<DOMRect | null>(null);
  const overlayRef = useRef<HTMLDivElement | null>(null);

  const onCloseRef = useRef(onClose);
  const onStartRef = useRef(onStart);
  useEffect(() => { onCloseRef.current = onClose; onStartRef.current = onStart; });

  const computePosition = useCallback((targetElement: Element, preferredPosition: Step['position']): TooltipPosition => {
    const rect = targetElement.getBoundingClientRect();
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    const tooltipHeight = 230;

    let top = 0;
    let left = 0;
    let arrowSide: TooltipPosition['arrowSide'] = preferredPosition;

    const spaceBelow = viewportHeight - rect.bottom;
    const spaceAbove = rect.top;

    if (preferredPosition === 'bottom') {
      if (spaceBelow >= tooltipHeight + TOOLTIP_OFFSET) {
        top = rect.bottom + TOOLTIP_OFFSET;
        arrowSide = 'top';
      } else {
        top = rect.top - tooltipHeight - TOOLTIP_OFFSET;
        arrowSide = 'bottom';
      }
      left = rect.left + rect.width / 2 - TOOLTIP_WIDTH / 2;
    } else if (preferredPosition === 'top') {
      if (spaceAbove >= tooltipHeight + TOOLTIP_OFFSET) {
        top = rect.top - tooltipHeight - TOOLTIP_OFFSET;
        arrowSide = 'bottom';
      } else if (spaceBelow >= tooltipHeight + TOOLTIP_OFFSET) {
        top = rect.bottom + TOOLTIP_OFFSET;
        arrowSide = 'top';
      } else {
        // Element prea mare — pune tooltip-ul centrat în viewport
        top = Math.max(12, viewportHeight / 2 - tooltipHeight / 2);
        arrowSide = 'bottom';
      }
      left = rect.left + rect.width / 2 - TOOLTIP_WIDTH / 2;
    } else if (preferredPosition === 'right') {
      top = rect.top + rect.height / 2 - tooltipHeight / 2;
      left = rect.right + TOOLTIP_OFFSET;
      arrowSide = 'left';
    } else {
      top = rect.top + rect.height / 2 - tooltipHeight / 2;
      left = rect.left - TOOLTIP_WIDTH - TOOLTIP_OFFSET;
      arrowSide = 'right';
    }

    left = Math.max(12, Math.min(left, viewportWidth - TOOLTIP_WIDTH - 12));
    top = Math.max(12, Math.min(top, viewportHeight - tooltipHeight - 12));

    return { top, left, arrowSide };
  }, []);

  const goToStep = useCallback((stepIndex: number) => {
    if (stepIndex >= STEPS.length) {
      setVisible(false);
      localStorage.setItem(STORAGE_KEY, '1');
      onCloseRef.current?.();
      return;
    }

    const step = STEPS[stepIndex];
    const targetElement = document.querySelector(step.targetSelector);

    if (!targetElement) {
      goToStep(stepIndex + 1);
      return;
    }

    targetElement.scrollIntoView({ behavior: 'instant', block: 'center' });

    requestAnimationFrame(() => {
      const rect = targetElement.getBoundingClientRect();
      setHighlightRect(rect);
      setTooltipPosition(computePosition(targetElement, step.position));
      setCurrentStep(stepIndex);
    });
  }, [computePosition]);

  const startWizard = useCallback(() => {
    setVisible(true);
    onStartRef.current?.();
    goToStep(0);
  }, [goToStep]);

  useEffect(() => {
    if (!forceShow) return;
    startWizard();
  }, [forceShow]);

  useEffect(() => {
    if (!visible) return;
    const preventScroll = (e: Event) => e.preventDefault();
    const preventKeys = (e: KeyboardEvent) => {
      if (['ArrowDown', 'ArrowUp', 'PageDown', 'PageUp', 'Home', 'End', ' '].includes(e.key)) {
        e.preventDefault();
      }
    };
    document.addEventListener('wheel', preventScroll, { passive: false });
    document.addEventListener('touchmove', preventScroll, { passive: false });
    document.addEventListener('keydown', preventKeys);
    return () => {
      document.removeEventListener('wheel', preventScroll);
      document.removeEventListener('touchmove', preventScroll);
      document.removeEventListener('keydown', preventKeys);
    };
  }, [visible]);

  useEffect(() => {
    const handleResize = () => {
      if (!visible) return;
      const step = STEPS[currentStep];
      const targetElement = document.querySelector(step.targetSelector);
      if (!targetElement) return;
      requestAnimationFrame(() => {
        const rect = targetElement.getBoundingClientRect();
        setHighlightRect(rect);
        setTooltipPosition(computePosition(targetElement, step.position));
      });
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [visible, currentStep, computePosition]);

  if (!visible || !tooltipPosition || !highlightRect) return null;

  const step = STEPS[currentStep];

  return (
    <div className={styles.root} ref={overlayRef}>
      {/* No way to skip: the tour is mandatory before the photos. */}
      <div className={styles.backdrop} />

      <div
        className={styles.highlight}
        style={{
          top: highlightRect.top - 6,
          left: highlightRect.left - 6,
          width: highlightRect.width + 12,
          height: highlightRect.height + 12,
        }}
      />

      <div
        className={`${styles.tooltip} ${styles[`arrow-${tooltipPosition.arrowSide}`]}`}
        style={{
          top: tooltipPosition.top,
          left: tooltipPosition.left,
          width: TOOLTIP_WIDTH,
        }}
      >
        <div className={styles.tooltipHeader}>
          <span className={styles.tooltipTitle}>{step.title}</span>
        </div>

        <p className={styles.tooltipDescription} dangerouslySetInnerHTML={{ __html: step.description }} />

        <div className={styles.tooltipFooter}>
          <span className={styles.stepIndicator}>
            {currentStep + 1} / {STEPS.length}
          </span>
          <div className={styles.footerActions}>
            {currentStep > 0 && (
              <button className={styles.btnSecondary} onClick={() => goToStep(currentStep - 1)}>
                Înapoi
              </button>
            )}
            <button className={styles.btnPrimary} onClick={() => goToStep(currentStep + 1)}>
              {currentStep === STEPS.length - 1 ? 'Gata!' : 'Următorul →'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
