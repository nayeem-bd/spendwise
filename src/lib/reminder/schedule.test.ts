import { atLocalTime, reminderDays } from './schedule';

const NINE_PM = 21 * 60;

describe('reminderDays', () => {
  it('includes today when nothing is logged and the time has not passed', () => {
    expect(reminderDays('2026-10-03', 10 * 60, false, NINE_PM, 3)).toEqual(['2026-10-03', '2026-10-04', '2026-10-05']);
  });

  it('skips today once something is logged', () => {
    expect(reminderDays('2026-10-03', 10 * 60, true, NINE_PM, 3)).toEqual(['2026-10-04', '2026-10-05']);
  });

  it('skips today after the reminder time', () => {
    expect(reminderDays('2026-10-03', NINE_PM, false, NINE_PM, 2)).toEqual(['2026-10-04']);
  });

  it('crosses month and year ends', () => {
    expect(reminderDays('2026-12-31', 0, true, NINE_PM, 3)).toEqual(['2027-01-01', '2027-01-02']);
  });
});

it('atLocalTime builds a local date', () => {
  const d = atLocalTime('2026-10-03', NINE_PM + 30);
  expect([d.getFullYear(), d.getMonth(), d.getDate(), d.getHours(), d.getMinutes()]).toEqual([2026, 9, 3, 21, 30]);
});
