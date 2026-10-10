import { useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { useAutoTextareaRows, useTextInput } from './TextInput.hook';
import { type TextInputProps } from './TextInput.types';
import * as S from './TextInput.styles';

function TextInput(props: TextInputProps) {
  const { mode = 'input', color = '#0080FF', maxCharacters = 500, label, id } = props;
  const { t } = useTranslation();
  const rootRef = useRef<HTMLDivElement>(null);
  const textareaRows = useAutoTextareaRows(rootRef, mode === 'input');
  const {
    text,
    tokens,
    needles,
    isDragging,
    handleTextChange,
    handlePointerMove,
    handlePointerDown,
    registerWord,
    getNeedlePosition,
    getWordStyle,
  } = useTextInput(props);

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
          data-testid="text-input-view"
          onPointerMove={handlePointerMove}
          onPointerDown={handlePointerDown}
        >
          {tokens.map((token, index) =>
            token.isWord ? (
              <span
                key={`word-${token.start}-${index}`}
                data-word-start={token.start}
                ref={registerWord(token.start)}
                style={getWordStyle(token.start, token.start + token.value.length)}
              >
                {token.value}
              </span>
            ) : (
              <span
                key={`ws-${token.start}-${index}`}
                data-testid="text-input-whitespace"
                data-token-start={token.start}
                style={getWordStyle(token.start, token.start + token.value.length)}
              >
                {token.value}
              </span>
            )
          )}
          {needles.map((needle) => {
            const position = getNeedlePosition(needle.boundary);
            return (
              <S.Needle
                key={`${needle.role}-${needle.boundary}`}
                data-testid="text-input-needle"
                data-role={needle.role}
                data-boundary={needle.boundary}
                data-snippet-id={needle.snippetId}
                aria-label={t(needle.labelKey)}
                style={{
                  left: position?.left ?? 0,
                  top: position?.top ?? 0,
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
