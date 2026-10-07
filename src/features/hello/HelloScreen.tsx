import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useDispatch, useSelector } from 'react-redux';
import styled from 'styled-components';
import { LanguageSwitch } from './LanguageSwitch';
import { healthRequested, type HelloRootState } from './helloSlice';

const Page = styled.main`
  max-width: 32rem;
  margin: 0 auto;
  padding: ${({ theme }) => theme.spacing.xl} ${({ theme }) => theme.spacing.lg};
  display: grid;
  gap: ${({ theme }) => theme.spacing.lg};
`;

const Title = styled.h1`
  margin: 0;
  font-size: ${({ theme }) => theme.type.size.xl};
  line-height: ${({ theme }) => theme.type.lineHeight.tight};
`;

const Status = styled.p`
  margin: 0;
  padding-top: ${({ theme }) => theme.spacing.md};
  border-top: 1px solid ${({ theme }) => theme.colour.hairline};
  color: ${({ theme }) => theme.colour.textMuted};
`;

export function HelloScreen() {
  const { t } = useTranslation();
  const dispatch = useDispatch();
  const health = useSelector((state: HelloRootState) => state.hello.health);

  useEffect(() => {
    dispatch(healthRequested());
  }, [dispatch]);

  const statusText =
    health.status === 'ready'
      ? t('hello.health.ok')
      : health.status === 'error'
        ? t('hello.health.error')
        : t('hello.health.loading');

  return (
    <Page>
      <Title>{t('app.name')}</Title>
      <p>{t('hello.title')}</p>
      <LanguageSwitch />
      <Status>
        {t('hello.health.label')}: <strong data-testid="health">{statusText}</strong>
      </Status>
    </Page>
  );
}
