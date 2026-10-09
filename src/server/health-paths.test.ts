import { isPublicHealthPath } from './health-paths';

describe('isPublicHealthPath', () => {
  it.each([[[]], [['live']], [['ready']]])('%j se reenvía', (segments) => {
    expect(isPublicHealthPath(segments)).toBe(true);
  });

  it.each([[['data-sources']], [['ready', 'x']], [['..']], [['LIVE']], [['metrics']]])(
    '%j no',
    (segments) => expect(isPublicHealthPath(segments)).toBe(false),
  );
});
