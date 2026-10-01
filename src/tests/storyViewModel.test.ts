import { describe, expect, it } from 'vitest';
import { createStarterStory } from '../models/story';
import { LocalStoryRepository } from '../repositories/storyRepository';
import { MemoryStorageService } from '../services/storageService';
import { StoryViewModel } from '../viewmodels/storyViewModel';

describe('story view model', () => {
  it('initializes, edits, persists, and restores the main flow', () => {
    const repository = new LocalStoryRepository(new MemoryStorageService());
    const viewModel = new StoryViewModel(repository);
    viewModel.initialize();
    expect(viewModel.snapshot.status).toBe('ready');
    viewModel.addCharacter('阿洛', '修复师');
    viewModel.addScene('地下档案室', '他们找到被隐藏的航海日志。');
    const scene = viewModel.selectedScene;
    expect(scene?.title).toBe('地下档案室');
    viewModel.toggleCharacter(scene?.id ?? '', viewModel.snapshot.story?.characters[2]?.id ?? '');
    expect(viewModel.snapshot.stats.characters).toBe(3);

    const restored = new StoryViewModel(repository);
    restored.initialize();
    expect(restored.snapshot.story?.scenes.some((item) => item.title === '地下档案室')).toBe(true);
    expect(restored.snapshot.story?.characters.some((item) => item.name === '阿洛')).toBe(true);
  });

  it('shows recoverable validation feedback and resets corrupt storage', () => {
    const storage = new MemoryStorageService();
    storage.write('{broken');
    const viewModel = new StoryViewModel(new LocalStoryRepository(storage));
    viewModel.initialize();
    viewModel.addCharacter(' ', '');
    expect(viewModel.snapshot.notice).toContain('至少');
    viewModel.resetProject();
    expect(viewModel.snapshot.story?.id).toBe(createStarterStory().id);
  });

  it('inserts scenes at a chosen position in v2 projects and lands on the new scene', () => {
    const viewModel = new StoryViewModel(new LocalStoryRepository(new MemoryStorageService()));
    viewModel.initialize();
    expect(viewModel.supportsSceneInsertion).toBe(true);
    const firstId = viewModel.snapshot.story!.scenes.find((scene) => scene.order === 1)!.id;

    const nonceBefore = viewModel.snapshot.sceneFocusNonce;
    viewModel.insertScene('灯塔停电', '夜里灯塔突然熄灭。', { mode: 'after', anchorSceneId: firstId });
    const story = viewModel.snapshot.story!;
    expect(story.scenes.map((scene) => scene.order)).toEqual([1, 2, 3]);
    expect(story.scenes.find((scene) => scene.id === story.selectedSceneId)?.title).toBe('灯塔停电');
    expect(story.selectedSceneId).toBe(story.scenes.find((scene) => scene.order === 2)?.id);
    expect(viewModel.snapshot.sceneFocusNonce).toBe(nonceBefore + 1);
  });

  it('warns on the spot when payoff would precede setup, leaving the timeline unchanged', () => {
    const viewModel = new StoryViewModel(new LocalStoryRepository(new MemoryStorageService()));
    viewModel.initialize();
    const clueId = viewModel.snapshot.story!.clues[0].id;
    const sceneCountBefore = viewModel.snapshot.story!.scenes.length;

    viewModel.insertScene('提前的回收', '不该出现在这里。', { mode: 'start', payoffClueId: clueId });
    expect(viewModel.snapshot.insertWarning).toContain('回收不能放在它之前');
    expect(viewModel.snapshot.story?.scenes).toHaveLength(sceneCountBefore);
    expect(viewModel.snapshot.story?.clues[0].payoffSceneId).toBe('');
  });

  it('keeps v1 legacy projects on append-only behavior', () => {
    const storage = new MemoryStorageService();
    const legacy = { ...createStarterStory(), version: 1 as const };
    storage.write(JSON.stringify(legacy));
    const viewModel = new StoryViewModel(new LocalStoryRepository(storage));
    viewModel.initialize();
    expect(viewModel.snapshot.story?.version).toBe(1);
    expect(viewModel.supportsSceneInsertion).toBe(false);

    viewModel.insertScene('老项目新幕', '仍追加在末尾。', { mode: 'start' });
    const scenes = [...viewModel.snapshot.story!.scenes].sort((a, b) => a.order - b.order);
    expect(scenes[scenes.length - 1].title).toBe('老项目新幕');
    expect(scenes.map((scene) => scene.order)).toEqual([1, 2, 3]);
  });
});
