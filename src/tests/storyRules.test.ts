import { describe, expect, it } from 'vitest';
import { createStarterStory } from '../models/story';
import {
  getStats,
  getTimelineWarning,
  insertSceneAt,
  orderedScenes,
  planSceneInsert,
  resolveInsertIndex,
  sanitizeStory,
  validateName,
} from '../models/storyRules';

describe('story domain rules', () => {
  it('sorts scenes and calculates unresolved clues', () => {
    const story = createStarterStory();
    story.scenes = [...story.scenes].reverse();
    expect(orderedScenes(story).map((scene) => scene.title)).toEqual(['旧港口的来信', '风暴前夜']);
    expect(getStats(story)).toMatchObject({ characters: 2, scenes: 2, clues: 1, unresolvedClues: 1, completion: 80 });
  });

  it('guards invalid names and duplicate timeline orders', () => {
    const story = createStarterStory();
    story.scenes[1].order = story.scenes[0].order;
    expect(validateName(' ')).toBe('至少输入 2 个字');
    expect(getTimelineWarning(story)).toContain('重复');
  });

  it('rejects corrupt persisted documents', () => {
    expect(sanitizeStory('{bad json}')).toBeNull();
    expect(sanitizeStory({ version: 99 })).toBeNull();
    expect(sanitizeStory(createStarterStory())).not.toBeNull();
  });

  it('resolves insert positions at the start, end, before, and after scenes', () => {
    const story = createStarterStory();
    const scenes = orderedScenes(story);
    const [first, second] = scenes;
    expect(resolveInsertIndex(scenes, { position: 'start' })).toBe(0);
    expect(resolveInsertIndex(scenes, { position: 'end' })).toBe(2);
    expect(resolveInsertIndex(scenes, { position: 'before', anchorSceneId: second.id })).toBe(1);
    expect(resolveInsertIndex(scenes, { position: 'after', anchorSceneId: first.id })).toBe(1);
    expect(resolveInsertIndex(scenes, { position: 'before', anchorSceneId: 'missing' })).toBe(-1);
  });

  it('inserts a scene and renumbers every scene consecutively', () => {
    const story = createStarterStory();
    const scenes = orderedScenes(story);
    const inserted = { ...scenes[0], id: 'scene-new', title: '新增的一幕' };
    const renumbered = insertSceneAt(scenes, inserted, 1);
    expect(renumbered.map((scene) => scene.order)).toEqual([1, 2, 3]);
    expect(renumbered.map((scene) => scene.title)).toEqual(['旧港口的来信', '新增的一幕', '风暴前夜']);
  });

  it('flags clues whose payoff would not come after setup after the insert', () => {
    const story = createStarterStory();
    const scenes = orderedScenes(story);
    // 回收幕排在埋下幕之前：插入无法改变已有场景的相对顺序，仍然说不通
    story.clues[0].payoffSceneId = scenes[0].id;
    const plan = planSceneInsert(story, { position: 'after', anchorSceneId: scenes[0].id });
    expect(plan.issues).toHaveLength(1);
    expect(plan.issues[0]).toMatchObject({ setupOrder: 1, payoffOrder: 1, clueTitle: story.clues[0].title });
    // 未回收的伏笔不会阻止插入
    story.clues[0].payoffSceneId = '';
    expect(planSceneInsert(story, { position: 'start' }).issues).toHaveLength(0);
  });
});
