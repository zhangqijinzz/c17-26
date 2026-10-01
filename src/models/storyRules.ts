import type { StoryDocument, StoryScene, StoryStats } from './story';

export function orderedScenes(story: StoryDocument): StoryScene[] {
  return [...story.scenes].sort((a, b) => a.order - b.order);
}

export type SceneInsertPosition = 'start' | 'end' | 'before' | 'after';

export interface ScenePlacement {
  position: SceneInsertPosition;
  anchorSceneId?: string;
}

export interface ClueOrderIssue {
  clueId: string;
  clueTitle: string;
  setupOrder: number;
  payoffOrder: number;
}

export interface SceneInsertPlan {
  /** 新场景在有序场景数组中的落点；-1 表示参照场景不存在 */
  index: number;
  /** 插入并重编号后，回收不晚于埋下的伏笔（同幕也算说不通） */
  issues: ClueOrderIssue[];
}

export function resolveInsertIndex(orderedSceneList: StoryScene[], placement: ScenePlacement): number {
  if (placement.position === 'start') return 0;
  if (placement.position === 'end') return orderedSceneList.length;
  const anchorIndex = orderedSceneList.findIndex((scene) => scene.id === placement.anchorSceneId);
  if (anchorIndex < 0) return -1;
  return placement.position === 'before' ? anchorIndex : anchorIndex + 1;
}

/**
 * 模拟插入后的幕序，检查埋下与回收的先后关系。
 * 插入不会改变已有场景的相对顺序，但老项目可能本就存在回收早于埋下的伏笔，
 * 插入后依然说不通，需要当场指出。
 */
export function planSceneInsert(story: StoryDocument, placement: ScenePlacement): SceneInsertPlan {
  const orderedSceneList = orderedScenes(story);
  const index = resolveInsertIndex(orderedSceneList, placement);
  if (index < 0) return { index, issues: [] };
  const orderAfterInsert = (sceneId: string): number | undefined => {
    const currentIndex = orderedSceneList.findIndex((scene) => scene.id === sceneId);
    if (currentIndex < 0) return undefined;
    return currentIndex + 1 + (currentIndex >= index ? 1 : 0);
  };
  const issues: ClueOrderIssue[] = [];
  for (const clue of story.clues) {
    if (!clue.payoffSceneId) continue;
    const setupOrder = orderAfterInsert(clue.setupSceneId);
    const payoffOrder = orderAfterInsert(clue.payoffSceneId);
    if (setupOrder !== undefined && payoffOrder !== undefined && payoffOrder <= setupOrder) {
      issues.push({ clueId: clue.id, clueTitle: clue.title, setupOrder, payoffOrder });
    }
  }
  return { index, issues };
}

/** 在指定落点插入场景，并把所有场景的 order 重新编号为连续的 1..n。 */
export function insertSceneAt(orderedSceneList: StoryScene[], scene: StoryScene, index: number): StoryScene[] {
  const next = [...orderedSceneList];
  next.splice(index, 0, scene);
  return next.map((item, itemIndex) => ({ ...item, order: itemIndex + 1 }));
}

export function describeClueOrderIssue(issue: ClueOrderIssue): string {
  return `伏笔「${issue.clueTitle}」第 ${issue.setupOrder} 幕才埋下，却在第 ${issue.payoffOrder} 幕回收`;
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

export function sanitizeStory(input: unknown): StoryDocument | null {
  if (!input || typeof input !== 'object') return null;
  const candidate = input as Partial<StoryDocument>;
  if (
    candidate.version !== 1 ||
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
