import { describe, expect, it } from 'vitest';
import { createId, createStarterStory } from '../models/story';
import type { StoryScene } from '../models/story';
import { getStats, getTimelineWarning, insertSceneAt, orderedScenes, sanitizeStory, validateName } from '../models/storyRules';

function draftScene(order: number): StoryScene {
  return {
    id: createId('scene'),
    title: `新场景${order}`,
    order,
    summary: '',
    conflict: '',
    characterIds: [],
    clueIds: [],
  };
}

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

  it('accepts v1 legacy documents and v2 documents', () => {
    const legacy = { ...createStarterStory(), version: 1 };
    expect(sanitizeStory(legacy)).not.toBeNull();
    expect(sanitizeStory({ ...createStarterStory(), version: 2 })).not.toBeNull();
  });

  it('inserts at start, after a scene, and before a scene with continuous orders', () => {
    const story = createStarterStory();
    const [first, second] = orderedScenes(story);

    const atStart = insertSceneAt(story, { scene: draftScene(3), mode: 'start' });
    expect(atStart.inserted).toBe(true);
    expect(atStart.story.scenes.map((scene) => scene.order)).toEqual([1, 2, 3]);
    expect(orderedScenes(atStart.story).map((scene) => scene.title)).toEqual(['新场景3', '旧港口的来信', '风暴前夜']);

    const afterFirst = insertSceneAt(story, { scene: draftScene(3), mode: 'after', anchorSceneId: first.id });
    expect(orderedScenes(afterFirst.story).map((scene) => scene.title)).toEqual(['旧港口的来信', '新场景3', '风暴前夜']);
    expect(afterFirst.story.scenes.map((scene) => scene.order)).toEqual([1, 2, 3]);

    const beforeSecond = insertSceneAt(story, { scene: draftScene(3), mode: 'before', anchorSceneId: second.id });
    expect(orderedScenes(beforeSecond.story).map((scene) => scene.title)).toEqual(['旧港口的来信', '新场景3', '风暴前夜']);

    const atEnd = insertSceneAt(story, { scene: draftScene(3), mode: 'end' });
    expect(orderedScenes(atEnd.story).map((scene) => scene.title)).toEqual(['旧港口的来信', '风暴前夜', '新场景3']);
  });

  it('rejects insertion when a clue payoff would land before its setup', () => {
    const story = createStarterStory();
    const clueId = story.clues[0].id;

    const blocked = insertSceneAt(story, { scene: draftScene(3), mode: 'start', payoffClueId: clueId });
    expect(blocked.inserted).toBe(false);
    expect(blocked.story).toBe(story);
    expect(blocked.warning).toContain('旧港口的来信');
    expect(orderedScenes(story).map((scene) => scene.title)).toEqual(['旧港口的来信', '风暴前夜']);

    const [first] = orderedScenes(story);
    const allowed = insertSceneAt(story, { scene: draftScene(3), mode: 'after', anchorSceneId: first.id, payoffClueId: clueId });
    expect(allowed.inserted).toBe(true);
    expect(allowed.story.clues.find((clue) => clue.id === clueId)?.payoffSceneId).toBe(allowed.story.scenes[1].id);
  });

  it('rejects an unknown anchor without changing the timeline', () => {
    const story = createStarterStory();
    const result = insertSceneAt(story, { scene: draftScene(3), mode: 'after', anchorSceneId: 'missing' });
    expect(result.inserted).toBe(false);
    expect(result.warning).toContain('参照');
    expect(result.story).toBe(story);
  });
});
