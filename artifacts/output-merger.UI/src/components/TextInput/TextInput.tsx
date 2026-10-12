import { useCallback, useLayoutEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { useAutoTextareaRows, useTextInput, withAlpha } from './TextInput.hook';
import { type TextInputProps } from './TextInput.types';
import * as S from './TextInput.styles';

function TextInput(props: TextInputProps) {
  const { mode = 'input', color = '#0080FF', maxCharacters = 500, label, id } = props;
  const { t } = useTranslation();
  const rootRef = useRef<HTMLDivElement>(null);
  const textareaRows = useAutoTextareaRows(rootRef, mode === 'input');
  const {
    text,
    segments,
    needles,
    isDragging,
    viewRef,
    handleTextChange,
    handlePointerMove,
    handlePointerDown,
    positionNeedle,
  } = useTextInput(props);

  const needleRefs = useRef(new Map<string, HTMLSpanElement>());
  const registerNeedle = useCallback((key: string) => (el: HTMLSpanElement | null) => {
    if (el) {
      needleRefs.current.set(key, el);
    } else {
      needleRefs.current.delete(key);
    }
  }, []);

  useLayoutEffect(() => {
    const root = viewRef.current;
    if (!root) return;
    const rootRect = root.getBoundingClientRect();
    needleRefs.current.forEach((el) => {
      const boundary = Number(el.dataset.boundary);
      const position = positionNeedle(boundary, rootRect);
      el.style.left = `${position?.left ?? 0}px`;
      el.style.top = `${position?.top ?? 0}px`;
    });
  });

  return (
    <S.TextInputRoot data-testid="text-input-root" data-mode={mode} id={id} ref={rootRef}>
      {label ? <S.Label>{label}</S.Label> : null}
      {mode === 'input' ? (
        <>
          <S.StyledTextField
            multiline
            rows={textareaRows}
            fullWidth
            value={text}
            placeholder={t('textInput.placeholder')}
            onChange={(e) => handleTextChange(e.target.value)}
            slotProps={{
              htmlInput: {
                maxLength: maxCharacters,
                'aria-label': t('textInput.placeholder'),
                'data-testid': 'text-input-textarea',
              },
            }}
            $accent={color}
          />
          <S.Counter data-testid="text-input-counter" aria-label={t('textInput.counterLabel')}>
            {`${text.length}/${maxCharacters}`}
          </S.Counter>
        </>
      ) : text.trim().length === 0 ? (
        <S.EmptyState data-testid="text-input-empty">{t('textInput.emptyView')}</S.EmptyState>
      ) : (
        <S.TextViewContainer
          ref={viewRef}
          data-testid="text-input-view"
          $dragging={isDragging}
          onPointerMove={handlePointerMove}
          onPointerDown={handlePointerDown}
        >
          {segments.map((segment) => {
            const content = text.slice(segment.start, segment.end);
            return segment.color ? (
              <S.Highlight
                key={`seg-${segment.start}`}
                data-segment-start={segment.start}
                data-testid="text-input-segment-highlight"
                style={{ backgroundColor: withAlpha(segment.color, segment.alpha ?? 0.3) }}
              >
                {content}
              </S.Highlight>
            ) : (
              <span
                key={`seg-${segment.start}`}
                data-segment-start={segment.start}
                data-testid="text-input-segment"
              >
                {content}
              </span>
            );
          })}
          {needles.map((needle) => {
            const key = `${needle.role}-${needle.boundary}`;
            return (
              <S.Needle
                key={key}
                ref={registerNeedle(key)}
                data-testid="text-input-needle"
                data-role={needle.role}
                data-boundary={needle.boundary}
                data-snippet-id={needle.snippetId}
                aria-label={t(needle.labelKey)}
                style={{
                  backgroundColor: needle.color,
                  pointerEvents: isDragging ? 'none' : 'auto',
                }}
              />
            );
          })}
        </S.TextViewContainer>
      )}
    </S.TextInputRoot>
  );
}

export default TextInput;
