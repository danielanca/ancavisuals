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
    title: '👆 Apasă pe o poză',
    description: 'Apasă pe orice poză ca să o vezi mărită. Poți naviga între ele cu săgețile sau swipe stânga/dreapta.',
    position: 'bottom',
  },
  {
    targetSelector: '[data-onboarding="print-btn"]',
    title: '🖨️ Adaugă la imprimare',
    description: 'Când ești în vizualizarea unei poze, apasă butonul verde pentru a o adăuga la lista de imprimare. Apasă din nou pentru a o elimina.',
    position: 'top',
  },
  {
    targetSelector: '[data-onboarding="download-btn"]',
    title: '⬇️ Descarcă pozele',
    description: 'Poți selecta pozele dorite și le descarci ca arhivă ZIP, sau descarci toate pozele dintr-o dată.',
    position: 'bottom',
  },
  {
    targetSelector: '[data-onboarding="pager"]',
    title: '📄 Navigare pagini',
    description: 'Pozele sunt împărțite pe pagini. Folosește butoanele de navigare pentru a trece la pagina următoare sau anterioară.',
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

export default function OnboardingWizard() {
  const [currentStep, setCurrentStep] = useState(0);
  const [visible, setVisible] = useState(false);
  const [tooltipPosition, setTooltipPosition] = useState<TooltipPosition | null>(null);
  const [highlightRect, setHighlightRect] = useState<DOMRect | null>(null);
  const overlayRef = useRef<HTMLDivElement | null>(null);

  const computePosition = useCallback((targetElement: Element, preferredPosition: Step['position']): TooltipPosition => {
    const rect = targetElement.getBoundingClientRect();
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    const tooltipHeight = 140;

    let top = 0;
    let left = 0;
    let arrowSide: TooltipPosition['arrowSide'] = preferredPosition;

    if (preferredPosition === 'bottom') {
      top = rect.bottom + TOOLTIP_OFFSET;
      left = rect.left + rect.width / 2 - TOOLTIP_WIDTH / 2;
      if (top + tooltipHeight > viewportHeight) {
        top = rect.top - tooltipHeight - TOOLTIP_OFFSET;
        arrowSide = 'bottom';
      }
    } else if (preferredPosition === 'top') {
      top = rect.top - tooltipHeight - TOOLTIP_OFFSET;
      left = rect.left + rect.width / 2 - TOOLTIP_WIDTH / 2;
      if (top < 0) {
        top = rect.bottom + TOOLTIP_OFFSET;
        arrowSide = 'top';
      }
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
    top = Math.max(12, top);

    return { top, left, arrowSide };
  }, []);

  const goToStep = useCallback((stepIndex: number) => {
    if (stepIndex >= STEPS.length) {
      setVisible(false);
      localStorage.setItem(STORAGE_KEY, '1');
      return;
    }

    const step = STEPS[stepIndex];
    const targetElement = document.querySelector(step.targetSelector);

    if (!targetElement) {
      goToStep(stepIndex + 1);
      return;
    }

    targetElement.scrollIntoView({ behavior: 'smooth', block: 'center' });

    setTimeout(() => {
      const rect = targetElement.getBoundingClientRect();
      setHighlightRect(rect);
      setTooltipPosition(computePosition(targetElement, step.position));
      setCurrentStep(stepIndex);
    }, 400);
  }, [computePosition]);

  useEffect(() => {
    const alreadySeen = localStorage.getItem(STORAGE_KEY);
    if (alreadySeen) return;

    const timer = setTimeout(() => {
      setVisible(true);
      goToStep(0);
    }, 800);

    return () => clearTimeout(timer);
  }, [goToStep]);

  useEffect(() => {
    const handleResize = () => {
      if (!visible) return;
      const step = STEPS[currentStep];
      const targetElement = document.querySelector(step.targetSelector);
      if (!targetElement) return;
      const rect = targetElement.getBoundingClientRect();
      setHighlightRect(rect);
      setTooltipPosition(computePosition(targetElement, step.position));
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [visible, currentStep, computePosition]);

  const handleSkip = () => {
    setVisible(false);
    localStorage.setItem(STORAGE_KEY, '1');
  };

  if (!visible || !tooltipPosition || !highlightRect) return null;

  const step = STEPS[currentStep];

  return (
    <div className={styles.root} ref={overlayRef}>
      <div className={styles.backdrop} onClick={handleSkip} />

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

        <p className={styles.tooltipDescription}>{step.description}</p>

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
              {currentStep === STEPS.length - 1 ? 'Gata!' : 'Următorul'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
