import { describe, it, expect } from 'vitest';
import { trainingWeek } from '../src/domain/calendar';
describe('Amsterdam training weeks', () => {
  it('rolls over at Monday 03:00 local, including just before the boundary', () => {
    expect(trainingWeek(Date.parse('2026-10-19T00:59:59.999Z')).id).toBe('2026-10-12');
    expect(trainingWeek(Date.parse('2026-10-19T01:00:00Z')).id).toBe('2026-10-19');
  });
  it('uses calendar weeks across spring and autumn DST', () => {
    const spring = trainingWeek(Date.parse('2026-03-25T12:00Z'));
    const autumn = trainingWeek(Date.parse('2026-10-22T12:00Z'));
    expect((spring.end - spring.start) / 3600000).toBe(167);
    expect((autumn.end - autumn.start) / 3600000).toBe(169);
    expect(trainingWeek(Date.parse('2026-03-29T01:00Z')).id).toBe('2026-03-23');
    expect(trainingWeek(Date.parse('2026-10-25T01:00Z')).id).toBe('2026-10-19');
  });
  it('handles year crossover without depending on the server timezone', () => {
    expect(trainingWeek(Date.parse('2027-01-01T12:00Z')).id).toBe('2026-12-28');
  });
});
