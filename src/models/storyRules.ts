import type { StoryDocument, StoryScene, StoryStats } from './story';

export function orderedScenes(story: StoryDocument): StoryScene[] {
  return [...story.scenes].sort((a, b) => a.order - b.order);
}

export function getStats(story: StoryDocument): StoryStats {
  const unresolvedClues = story.clues.filter((clue) => clue.payoffSceneId === '').length;
  const totalSignals = story.characters.length + story.scenes.length + story.clues.length;
  const completedSignals = story.characters.length + story.scenes.length + (story.clues.length - unresolvedClues);
  const completion = totalSignals === 0 ? 0 : Math.round((completedSignals / totalSignals) * 100);
  return {
    characters: story.characters.length,
    scenes: story.scenes.length,
    clues: story.clues.length,
    unresolvedClues,
    completion,
  };
}

export function validateName(value: string): string {
  const cleanValue = value.trim();
  return cleanValue.length < 2 ? '至少输入 2 个字' : cleanValue;
}

export function getTimelineWarning(story: StoryDocument): string | null {
  const orders = story.scenes.map((scene) => scene.order);
  return new Set(orders).size !== orders.length ? '时间线存在重复顺序，请重新排列。' : null;
}

export type SceneInsertMode = 'start' | 'end' | 'before' | 'after';

export interface SceneInsertRequest {
  scene: StoryScene;
  mode: SceneInsertMode;
  /** mode 为 before / after 时参照的场景 id */
  anchorSceneId?: string;
  /** 新场景同时作为某个待回收伏笔的回收场景 */
  payoffClueId?: string;
}

export interface SceneInsertResult {
  story: StoryDocument;
  warning: string | null;
  inserted: boolean;
}

/**
 * 在指定位置插入一幕：插入后所有场景的 order 从 1 连续重排。
 * 如果新场景承担某个伏笔的回收，却落在该伏笔埋下的场景之前（埋点不存在同样视为不通），
 * 则拒绝插入并返回当场提醒，原时间线保持不变。
 */
export function insertSceneAt(story: StoryDocument, request: SceneInsertRequest): SceneInsertResult {
  const ordered = orderedScenes(story);
  let index = ordered.length;
  if (request.mode === 'start') {
    index = 0;
  } else if (request.mode === 'before' || request.mode === 'after') {
    const anchorIndex = ordered.findIndex((scene) => scene.id === request.anchorSceneId);
    if (anchorIndex < 0) {
      return { story, inserted: false, warning: '找不到参照的场景，请重新选择插入位置。' };
    }
    index = request.mode === 'before' ? anchorIndex : anchorIndex + 1;
  }

  if (request.payoffClueId) {
    const clue = story.clues.find((item) => item.id === request.payoffClueId);
    if (!clue || clue.payoffSceneId) {
      return { story, inserted: false, warning: '该伏笔已经回收或不存在，请重新选择。' };
    }
    const setupIndex = ordered.findIndex((scene) => scene.id === clue.setupSceneId);
    if (setupIndex < 0) {
      return { story, inserted: false, warning: `伏笔「${clue.title}」缺少埋下的场景，暂时无法安排回收。` };
    }
    if (index <= setupIndex) {
      const setupTitle = ordered[setupIndex].title;
      return {
        story,
        inserted: false,
        warning: `伏笔「${clue.title}」在第 ${setupIndex + 1} 幕「${setupTitle}」才埋下，回收不能放在它之前，请更换插入位置。`,
      };
    }
  }

  const nextScenes = [...ordered.slice(0, index), request.scene, ...ordered.slice(index)].map((scene, sceneIndex) => ({
    ...scene,
    order: sceneIndex + 1,
  }));
  let nextClues = story.clues;
  if (request.payoffClueId) {
    nextClues = story.clues.map((clue) =>
      clue.id === request.payoffClueId ? { ...clue, payoffSceneId: request.scene.id } : clue,
    );
  }
  return {
    story: { ...story, scenes: nextScenes, clues: nextClues },
    inserted: true,
    warning: null,
  };
}

export function sanitizeStory(input: unknown): StoryDocument | null {
  if (!input || typeof input !== 'object') return null;
  const candidate = input as Partial<StoryDocument>;
  if (
    (candidate.version !== 1 && candidate.version !== 2) ||
    typeof candidate.id !== 'string' ||
    typeof candidate.title !== 'string' ||
    !Array.isArray(candidate.characters) ||
    !Array.isArray(candidate.scenes) ||
    !Array.isArray(candidate.clues)
  ) {
    return null;
  }
  return candidate as StoryDocument;
}
