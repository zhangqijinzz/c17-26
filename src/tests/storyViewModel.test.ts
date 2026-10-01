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

  it('inserts a scene at a chosen position, renumbers consecutively, and selects it', () => {
    const repository = new LocalStoryRepository(new MemoryStorageService());
    const viewModel = new StoryViewModel(repository);
    viewModel.initialize();
    const firstId = viewModel.snapshot.story!.scenes.find((scene) => scene.order === 1)!.id;
    const ok = viewModel.insertScene('灯塔停电', '午夜灯塔忽然熄灭。', { position: 'after', anchorSceneId: firstId });
    expect(ok).toBe(true);
    const scenes = [...viewModel.snapshot.story!.scenes].sort((a, b) => a.order - b.order);
    expect(scenes.map((scene) => scene.order)).toEqual([1, 2, 3]);
    expect(scenes.map((scene) => scene.title)).toEqual(['旧港口的来信', '灯塔停电', '风暴前夜']);
    expect(viewModel.selectedScene?.title).toBe('灯塔停电');
    expect(viewModel.snapshot.notice).toContain('已在第 2 幕插入');

    viewModel.insertScene('序章', '故事开始之前。', { position: 'start' });
    const headScenes = [...viewModel.snapshot.story!.scenes].sort((a, b) => a.order - b.order);
    expect(headScenes[0].order).toBe(1);
    expect(headScenes[0].title).toBe('序章');
    expect(viewModel.selectedScene?.title).toBe('序章');
  });

  it('keeps the legacy append behavior identical when adding the old way', () => {
    const repository = new LocalStoryRepository(new MemoryStorageService());
    const viewModel = new StoryViewModel(repository);
    viewModel.initialize();
    viewModel.addScene('尾声', '一切归于平静。');
    const scenes = viewModel.snapshot.story!.scenes;
    expect(scenes).toHaveLength(3);
    expect(scenes[2]).toMatchObject({ title: '尾声', order: 3, summary: '一切归于平静。' });
    expect(viewModel.snapshot.story!.selectedSceneId).toBe(scenes[2].id);
    expect(viewModel.snapshot.notice).toBe('已创建场景「尾声」');
  });

  it('refuses the insert on the spot when clue setup/payoff order stops making sense', () => {
    const repository = new LocalStoryRepository(new MemoryStorageService());
    const viewModel = new StoryViewModel(repository);
    viewModel.initialize();
    const scenes = [...viewModel.snapshot.story!.scenes].sort((a, b) => a.order - b.order);
    // 埋下在第 2 幕、回收却在第 1 幕，本就说不通
    viewModel.addClue('罗盘刻痕', scenes[1].id, scenes[0].id);
    const beforeCount = viewModel.snapshot.story!.scenes.length;
    const ok = viewModel.insertScene('新的一幕', '发生了什么。', { position: 'start' });
    expect(ok).toBe(false);
    expect(viewModel.snapshot.story!.scenes).toHaveLength(beforeCount);
    expect(viewModel.snapshot.notice).toContain('罗盘刻痕');
    expect(viewModel.snapshot.notice).toContain('没有插入');
  });
});
