import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { styled } from 'styled-components';
import { fetchImages, fetchSettings } from '../../api/client';
import { currentSellerSlug } from '../../api/device/sellerContext';
import { Button, Icon } from '../../ui';
import { Aside, Columns, Label } from './homeParts';
import { HOME_NS } from './i18n/register';
import type { GoTarget } from './types';

// State 1, the body: the setup checklist (pictures, WhatsApp number, first menu, publish) and
// "How it works". The checklist reads what is done from the same places Settings does.

const List = styled.ol`
  margin: 0;
  padding: 0;
  list-style: none;
`;
const Item = styled.li`
  display: grid;
  grid-template-columns: auto minmax(0, 1fr) auto;
  align-items: center;
  gap: ${({ theme }) => theme.spacing.md};
  min-height: ${({ theme }) => theme.size.rowOrder}px;
  padding: ${({ theme }) => theme.spacing.sm} 0;
  border-top: ${({ theme }) => theme.border.hairline} solid ${({ theme }) => theme.c.line};

  strong {
    display: block;
    font-weight: 600;
  }
  small {
    color: ${({ theme }) => theme.c.muted};
    font-size: 0.875rem;
  }
`;
const Mark = styled.span<{ $done: boolean }>`
  display: inline-flex;
  width: 1.5rem;
  height: 1.5rem;
  align-items: center;
  justify-content: center;
  border: ${({ theme }) => theme.border.hairline} solid
    ${({ $done, theme }) => ($done ? theme.c.fill : theme.c.ctrl)};
  border-radius: 50%;
  background: ${({ $done, theme }) => ($done ? theme.c.fill : 'transparent')};
  color: ${({ theme }) => theme.c.on};

  svg {
    width: 0.875rem;
    height: 0.875rem;
  }
`;

type Step = Readonly<{
  id: string;
  title: string;
  note: string;
  done: boolean;
  action?: Readonly<{ label: string; run: () => void }>;
}>;

export type FirstTimeProps = Readonly<{
  /** The seller saved a WhatsApp number in the dialog this visit. */
  whatsappSaved: boolean;
  /** The first menu was started (dishes added, a step reached, or Make your first menu used). */
  menuStarted: boolean;
  onSetUpWhatsApp: () => void;
  onMakeMenu: () => void;
  onGo: (target: GoTarget) => void;
}>;

export function FirstTime({
  whatsappSaved,
  menuStarted,
  onSetUpWhatsApp,
  onMakeMenu,
  onGo,
}: FirstTimeProps) {
  const { t } = useTranslation(HOME_NS);
  const [pictures, setPictures] = useState(false);
  const [whatsapp, setWhatsapp] = useState(false);
  useEffect(() => {
    let live = true;
    const slug = currentSellerSlug();
    void fetchImages(undefined, slug).then((result) => {
      if (live && result.ok) {
        const { railImage, railIcon, desktopBanner, phoneBanner } = result.data.images;
        setPictures([railImage, railIcon, desktopBanner, phoneBanner].some(Boolean));
      }
    });
    void fetchSettings(undefined, slug).then((result) => {
      if (live && result.ok) setWhatsapp(Boolean(result.data.settings.whatsappNumber));
    });
    return () => {
      live = false;
    };
  }, []);

  const steps: ReadonlyArray<Step> = [
    {
      id: 'pictures',
      title: t('firstTime.pictures'),
      note: t('firstTime.picturesNote'),
      done: pictures,
      ...(pictures
        ? {}
        : { action: { label: t('firstTime.goSettings'), run: () => onGo('settings') } }),
    },
    {
      id: 'whatsapp',
      title: t('firstTime.whatsapp'),
      note: t('firstTime.whatsappNote'),
      done: whatsapp || whatsappSaved,
      action: { label: t('firstTime.setUp'), run: onSetUpWhatsApp },
    },
    {
      id: 'menu',
      title: t('firstTime.menu'),
      note: t('firstTime.menuNote'),
      done: menuStarted,
      action: { label: t('firstTime.makeMenu'), run: onMakeMenu },
    },
    { id: 'publish', title: t('firstTime.publish'), note: t('firstTime.publishNote'), done: false },
  ];

  return (
    <Columns>
      <section aria-labelledby="home-checklist">
        <Label id="home-checklist">{t('firstTime.checklist')}</Label>
        <List>
          {steps.map((step) => (
            <Item key={step.id}>
              <Mark $done={step.done}>{step.done ? <Icon name="check" /> : null}</Mark>
              <span>
                <strong>{step.title}</strong>
                <small>{step.done ? `${step.note} · ${t('firstTime.done')}` : step.note}</small>
              </span>
              {step.action && !step.done ? (
                <Button onClick={step.action.run}>{step.action.label}</Button>
              ) : null}
            </Item>
          ))}
        </List>
      </section>
      <Aside>
        <Label>{t('firstTime.howTitle')}</Label>
        <p>{t('firstTime.how1')}</p>
        <p>{t('firstTime.how2')}</p>
        <p>{t('firstTime.how3')}</p>
      </Aside>
    </Columns>
  );
}
