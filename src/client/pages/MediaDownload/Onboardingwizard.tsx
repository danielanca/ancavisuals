import { useEffect, useRef, useState, useCallback } from 'react';
import styles from './OnboardingWizard.module.scss';

type Step = {
  targetSelector: string;
  title: string;
  description: string;
  position: 'top' | 'bottom' | 'left' | 'right';
};

const STEPS: Step[] = [
  {
    targetSelector: '[data-onboarding="photo"]',
    title: '👆 Apasă pe orice poză',
    description: 'Apasă pe orice poză ca s-o vezi <strong>mărită la rezoluție completă</strong>. Navighezi cu <strong>săgețile</strong> din lateral sau cu <strong>swipe stânga/dreapta</strong> pe telefon.',
    position: 'bottom',
  },
  {
    targetSelector: '[data-onboarding="pager"]',
    title: '📄 Navigare între pagini',
    description: 'Pozele sunt împărțite pe <strong>mai multe pagini</strong>. Folosești <strong>săgețile ‹ ›</strong> pentru pagina anterioară/următoare, sau scrii <strong>numărul direct</strong> în căsuță și apeși Enter.',
    position: 'top',
  },
  {
    targetSelector: '[data-onboarding="subscribe"]',
    title: '🔔 Notificare poze noi',
    description: 'Introdu adresa de email și apasă <strong>Abonează-te</strong>. Primești <strong>automat un email</strong> când fotograful adaugă poze noi — fără să mai intri zilnic să verifici.',
    position: 'bottom',
  },
  {
    targetSelector: '[data-onboarding="download-btn"]',
    title: '⬇️ Descarcă toate pozele',
    description: 'Apasă pentru a descărca <strong>toate pozele</strong> ca arhivă ZIP, la <strong>calitate completă</strong>, exact cum au ieșit din aparat. Poate dura câteva minute.',
    position: 'top',
  },
  {
    targetSelector: '[data-onboarding="print-btn"]',
    title: '🖨️ Alege poze pentru imprimare',
    description: 'Apasă <strong>Modifică selecția pentru imprimare</strong>, bifează pozele dorite, salvează — fotograful vede exact ce ai ales și pregătește <strong>comanda de imprimare</strong>.',
    position: 'top',
  },
  {
    targetSelector: '[data-onboarding="print-section"]',
    title: '📋 Zona pozelor de imprimat',
    description: 'Aceasta este <strong>secțiunea de imprimare</strong>. Pozele pe care le selectezi apar aici. Poți <strong>adăuga sau elimina</strong> orice poză oricând, înainte ca fotograful să pregătească comanda.',
    position: 'top',
  },
];

type TooltipPosition = {
  top: number;
  left: number;
  arrowSide: 'top' | 'bottom' | 'left' | 'right';
};

const STORAGE_KEY = 'av:onboarding:done';
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

  const handleSkip = () => {
    setVisible(false);
    localStorage.setItem(STORAGE_KEY, '1');
    onClose?.();
  };

  if (!visible || !tooltipPosition || !highlightRect) return null;

  const step = STEPS[currentStep];

  return (
    <div className={styles.root} ref={overlayRef}>
      <div className={styles.backdrop} onClick={handleSkip} />

      <button className={styles.skipTopBtn} onClick={handleSkip}>
        Sari peste tutorial ✕
      </button>

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
          <button className={styles.skipBtn} onClick={handleSkip} aria-label="Sari peste">
            ✕
          </button>
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
