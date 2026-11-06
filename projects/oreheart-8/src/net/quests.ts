// Daily Quests (contract 4.2): today's jobs with a progress bar, the coin reward, a Done tick, days left,
// one free Reroll a day, and the quest streak (a free pack every 7 days of finished quests).
import { h } from '../ui/app';
import { daysLeft } from './quest-summary';
export { daysLeft };
import { econShow, backBtn, coinChip, coinIcon, api, rememberQuests, refreshCoins, openScreen, STREAK_DAYS, type Quest, type QuestsInfo } from './economy';

type El = HTMLElement;


const TIER: Record<string, string> = { easy: 'Easy', medium: 'Medium', hard: 'Hard' };

export async function showQuests(): Promise<void> {
  const list = h('div', { class: 'q-list', role: 'list', 'aria-label': 'Daily quests' }, h('p', { class: 'net-note' }, 'Fetching orders from the Arena Master…'));
  const streak = h('div', { class: 'q-streak econ-panel' });
  const alert = h('p', { class: 'econ-alert', role: 'alert' });
  // Nov 6 (design D): the daily panel's head (reroll left, new quests), the weekly panel (coming soon) and the streak's seven day cards
  const dailyHead = h('div', { class: 'q-dhead' }, h('h2', { class: 'h' }, h('img', { src: '/art/packs/icons/quest.webp', alt: '' }), 'Daily quests'), h('div', { class: 'q-pills' }));
  const dailyFoot = h('p', { class: 'q-foot' }, 'Rewards: ', h('b', {}, 'Easy 25'), ' \u00b7 ', h('b', {}, 'Medium 50'), ' \u00b7 ', h('b', {}, 'Hard 75'), ' coins \u00a0\u00a0 Matches against the computer count too');
  const weekly = h('section', { class: 'econ-panel q-weekly', 'data-testid': 'quest-weekly', 'aria-label': 'Weekly quests' }, h('h2', { class: 'h' }, h('img', { src: '/art/packs/icons/quest.webp', alt: '' }), 'Weekly quests'), h('p', { class: 'q-soon' }, 'Coming soon: bigger jobs that run Monday to Sunday, with packs on top.'));
  const days = h('div', { class: 'q-days', 'aria-hidden': 'true' });
  const days_el = days; // (the count inside draw() is also called `days`)
  const streakBox = h('section', { class: 'econ-panel q-streakbox', 'aria-label': 'Free pack streak' }, h('div', { class: 'q-shead' }, h('h2', { class: 'h' }, h('img', { src: '/art/packs/icons/free-pack.webp', alt: '' }), 'Free pack streak'), h('span', { class: 'q-srow' })), days, streak);
  econShow('quests',
    h('div', { class: 'econ-head' }, backBtn(),
      h('div', { class: 'econ-titles' }, h('h1', {}, 'Daily Quests'), h('p', { class: 'econ-sub' }, 'Fresh orders from the Arena Master. Finish them before they go stale.')),
      coinChip()),
    alert,
    h('div', { class: 'q-main' },
      h('section', { class: 'econ-panel q-daily', 'aria-label': 'Daily quests' }, dailyHead, list, dailyFoot),
      h('div', { class: 'q-under' }, weekly, streakBox)));
  let q: QuestsInfo;
  try { q = await api.myQuests(); } catch (e: any) { list.replaceChildren(); alert.textContent = 'Could not load your quests: ' + String(e?.message || e); return; }
  draw(q);

  function draw(info: QuestsInfo) {
    rememberQuests(info);
    const qs = info.quests || [];
    list.replaceChildren(...(qs.length ? qs.map((x) => row(x, info)) : [h('p', { class: 'net-note' }, 'No quests right now. Even heroes need a day off.')]));
    const days = Math.max(0, info.streak_days || 0);
    const into = days % STREAK_DAYS;
    // the head pills: rerolls left and when the quests change; the seven day cards (the lit ones, today, the pack at the end)
    const soonest = qs.filter((x) => !x.done).map((x) => x.expires_on).sort()[0];
    (dailyHead.querySelector('.q-pills') as El).replaceChildren(
      h('span', { class: 'q-pill', 'data-testid': 'quest-rerolls' }, h('img', { src: '/art/packs/icons/reroll.webp', alt: '' }), info.reroll_left > 0 ? `${info.reroll_left} free reroll${info.reroll_left === 1 ? '' : 's'} left` : 'No rerolls left today'),
      soonest ? h('span', { class: 'q-pill' }, 'New quests ', h('b', {}, daysLeft(soonest, info.today))) : null);
    const allDone = qs.length > 0 && qs.every((x) => x.done);
    days_el.replaceChildren(...Array.from({ length: STREAK_DAYS }, (_, i) => {
      const lit = i < into || (days > 0 && into === 0), today = i === into && !(days > 0 && into === 0), last = i === STREAK_DAYS - 1;
      return h('div', { class: 'q-day' + (lit ? ' on' : '') + (today ? ' today' : '') + (last ? ' pack' : '') }, last ? h('img', { src: '/art/packs/icons/free-pack.webp', alt: '' }) : h('i', {}, lit ? '\u2713' : today ? `${qs.filter((x) => x.done).length}/${qs.length || 3}` : ''), h('span', {}, last ? `Day ${STREAK_DAYS} \u00b7 Free pack` : today ? 'Today' : `Day ${i + 1}`));
    }));
    (streakBox.querySelector('.q-srow') as El).textContent = days > 0 ? `${days} day${days === 1 ? '' : 's'} in a row${allDone ? ' \u00b7 today is done' : ''}` : 'Finish all 3 today to start';
    const dots = h('span', { class: 'q-dots', 'aria-hidden': 'true' }, ...Array.from({ length: STREAK_DAYS }, (_, i) => h('i', { class: i < into || (days > 0 && into === 0) ? 'on' : '' })));
    streak.replaceChildren(h('img', { src: '/art/packs/icons/free-pack.webp', alt: '' }),
      h('span', { 'data-testid': 'quest-streak' }, `Quest streak: ${days} day${days === 1 ? '' : 's'} (free pack at ${STREAK_DAYS})`), dots,
      info.free_packs > 0 ? h('button', { type: 'button', class: 'net-btn primary', onclick: () => { void openScreen('shop'); } }, `Open your free pack${info.free_packs > 1 ? 's' : ''}!`) : null);
  }

  function row(x: Quest, info: QuestsInfo): El {
    const done = !!x.done;
    const p = Math.max(0, Math.min(x.target || 1, x.progress || 0));
    const frac = x.target > 0 ? p / x.target : done ? 1 : 0;
    const reroll = !done && info.reroll_left > 0 ? h('button', { type: 'button', class: 'net-btn q-reroll', 'aria-label': `Reroll ${x.name}`, title: 'Swap this quest for another (once a day)' }, h('img', { src: '/art/packs/icons/reroll.webp', alt: '' }), 'Reroll') as HTMLButtonElement : null;
    reroll?.addEventListener('click', async () => {
      alert.textContent = '';
      for (const b of document.querySelectorAll<HTMLButtonElement>('.q-reroll')) b.disabled = true;
      try { draw(await api.questReroll(x.id)); } catch (e: any) { alert.textContent = String(e?.message || e); for (const b of document.querySelectorAll<HTMLButtonElement>('.q-reroll')) b.disabled = false; }
    });
    const fill = h('div', { class: 'q-fill' });
    fill.style.transform = `scaleX(${frac.toFixed(3)})`;
    return h('div', { class: `q-row econ-panel${done ? ' done' : ''}`, role: 'listitem', 'data-quest': x.quest_id, 'data-done': String(done), 'data-tier': x.tier },
      h('span', { class: 'q-tag', 'aria-hidden': 'true' }, TIER[x.tier] || x.tier),
      h('img', { class: 'q-icon', src: done ? '/art/packs/icons/quest-done.webp' : '/art/packs/icons/quest.webp', alt: done ? 'Done' : 'Quest' }),
      h('div', { class: 'q-main' },
        h('p', { class: 'q-name' }, x.name, h('span', { class: 'q-tier' }, TIER[x.tier] || x.tier)),
        h('p', { class: 'q-text' }, x.text),
        h('div', { class: 'q-bar', role: 'progressbar', 'aria-label': `${x.name} progress`, 'aria-valuemin': '0', 'aria-valuemax': String(x.target), 'aria-valuenow': String(p) }, fill),
        h('div', { class: 'q-meta' }, h('span', { class: 'q-progress' }, `${p} / ${x.target}`), done ? null : h('span', {}, daysLeft(x.expires_on, info.today)))),
      h('div', { class: 'q-side' },
        done ? h('span', { class: 'q-paid', 'aria-label': `Done, ${x.reward} coins paid` }, h('img', { src: '/art/packs/icons/quest-done.webp', alt: '' }), '+' + x.reward) : h('span', { class: 'q-reward', 'aria-label': `Reward ${x.reward} coins` }, coinIcon(''), '+' + x.reward),
        reroll));
  }
  void refreshCoins();
}
