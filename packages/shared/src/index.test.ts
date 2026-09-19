import { describe, expect, it } from 'vitest';
import {
  ONET_MNM_CAREER_SECTIONS,
  RIASEC_KEYS,
  isBrightOutlook,
  type CareerReference,
} from './index';

describe('ONET_MNM_CAREER_SECTIONS', () => {
  it('lists the eight career detail sections the proxy exposes', () => {
    expect(ONET_MNM_CAREER_SECTIONS).toEqual([
      'skills',
      'knowledge',
      'abilities',
      'personality',
      'education',
      'job_outlook',
      'technology',
      'explore_more',
    ]);
  });
});

describe('RIASEC_KEYS', () => {
  it('lists the six RIASEC interest areas', () => {
    expect(RIASEC_KEYS).toEqual([
      'realistic',
      'investigative',
      'artistic',
      'social',
      'enterprising',
      'conventional',
    ]);
  });
});

describe('isBrightOutlook', () => {
  it('is true when the tag is set', () => {
    const career: CareerReference = {
      href: 'https://example.test/careers/15-1252.00/',
      code: '15-1252.00',
      title: 'Software Developers',
      tags: { bright_outlook: true },
    };
    expect(isBrightOutlook(career)).toBe(true);
  });

  it('is false when the tag is absent or false', () => {
    const withoutTags: CareerReference = {
      href: 'https://example.test/careers/15-1252.00/',
      code: '15-1252.00',
      title: 'Software Developers',
    };
    const withFalseTag: CareerReference = {
      ...withoutTags,
      tags: { bright_outlook: false },
    };
    expect(isBrightOutlook(withoutTags)).toBe(false);
    expect(isBrightOutlook(withFalseTag)).toBe(false);
  });
});
