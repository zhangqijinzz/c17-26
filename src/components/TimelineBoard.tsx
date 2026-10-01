import { useEffect, useState } from 'react';
import type { StoryScene } from '../models/story';
import type { SceneInsertMode } from '../models/storyRules';
import type { StoryViewModel } from '../viewmodels/storyViewModel';

interface TimelineBoardProps { viewModel: StoryViewModel; scenes: StoryScene[]; }

export function TimelineBoard({ viewModel, scenes }: TimelineBoardProps) {
  const { story } = viewModel.snapshot;
  const supportsInsertion = viewModel.supportsSceneInsertion;
  const allScenes = story ? [...story.scenes].sort((a, b) => a.order - b.order) : [];
  const [title, setTitle] = useState('');
  const [summary, setSummary] = useState('');
  const [position, setPosition] = useState('end');
  const [payoffClueId, setPayoffClueId] = useState('');

  const parsePosition = (value: string): { mode: SceneInsertMode; anchorSceneId?: string } => {
    if (value === 'start' || value === 'end') return { mode: value };
    const [mode, anchorSceneId] = value.split(':');
    return { mode: (mode === 'before' ? 'before' : 'after') as SceneInsertMode, anchorSceneId };
  };

  const submit = () => {
    if (supportsInsertion) {
      const { mode, anchorSceneId } = parsePosition(position);
      viewModel.insertScene(title, summary, { mode, anchorSceneId, payoffClueId: payoffClueId || undefined });
    } else {
      viewModel.addScene(title, summary);
    }
    setTitle('');
    setSummary('');
    setPayoffClueId('');
  };

  // 插入完成后把新场景滚动到可视区域，作者无需再手动找到它；
  // 仅响应插入动作（sceneFocusNonce 递增），编辑标题等普通更新不应触发滚动
  const focusNonce = viewModel.snapshot.sceneFocusNonce;
  useEffect(() => {
    if (focusNonce === 0) return;
    const selectedId = viewModel.snapshot.story?.selectedSceneId;
    if (!selectedId) return;
    const node = document.querySelector<HTMLElement>(`[data-scene-id="${selectedId}"]`);
    node?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }, [focusNonce, viewModel]);

  return (
    <section className="panel timeline-panel">
      <div className="panel-heading timeline-heading"><div><span className="eyebrow">SEQUENCE / 时间结构</span><h2>故事时间线</h2></div><div className="timeline-actions"><span className="hint">拖动感受节奏 · 点击编辑详情</span><button className="secondary-button" onClick={submit}>＋ 新建场景</button></div></div>
      {viewModel.timelineWarning && <div className="warning-banner">△ {viewModel.timelineWarning}</div>}
      <div className="timeline-rail">
        {scenes.map((scene, index) => {
          const selected = story?.selectedSceneId === scene.id;
          const characterCount = story?.characters.filter((character) => scene.characterIds.includes(character.id)).length ?? 0;
          return <button className={selected ? 'scene-node selected' : 'scene-node'} data-scene-id={scene.id} key={scene.id} onClick={() => viewModel.selectScene(scene.id)}><span className="scene-index">{String(index + 1).padStart(2, '0')}</span><span className="scene-line" /><span className="scene-dot" /><div className="scene-copy"><span className="scene-meta">SCENE {String(index + 1).padStart(2, '0')} · {characterCount} 位人物</span><strong>{scene.title}</strong><span>{scene.summary}</span><div className="scene-tags">{scene.conflict && <em>冲突</em>}{scene.clueIds.length > 0 && <em className="clue-tag">伏笔 {scene.clueIds.length}</em>}</div></div></button>;
        })}
        {scenes.length === 0 && <div className="empty-state">时间线还没有场景。创建第一幕，让故事开始移动。</div>}
      </div>
      {supportsInsertion && viewModel.snapshot.insertWarning && <div className="warning-banner insert-warning" role="alert">△ {viewModel.snapshot.insertWarning}</div>}
      <div className="create-scene-row">
        <input aria-label="场景标题" value={title} onChange={(event) => { setTitle(event.target.value); viewModel.clearInsertWarning(); }} placeholder="新场景标题，例如：灯塔停电" />
        <input aria-label="场景摘要" value={summary} onChange={(event) => setSummary(event.target.value)} placeholder="一句话写下这一幕发生了什么" />
        {supportsInsertion && (
          <>
            <select aria-label="插入位置" value={position} onChange={(event) => { setPosition(event.target.value); viewModel.clearInsertWarning(); }}>
              <option value="start">放在时间线开头</option>
              {allScenes.map((scene, index) => (
                <option key={`before:${scene.id}`} value={`before:${scene.id}`}>{`插到第 ${index + 1} 幕「${scene.title}」之前`}</option>
              ))}
              {allScenes.map((scene, index) => (
                <option key={`after:${scene.id}`} value={`after:${scene.id}`}>{`接在第 ${index + 1} 幕「${scene.title}」之后`}</option>
              ))}
              <option value="end">放在时间线结尾</option>
            </select>
            <select aria-label="回收伏笔" value={payoffClueId} onChange={(event) => { setPayoffClueId(event.target.value); viewModel.clearInsertWarning(); }}>
              <option value="">不安排伏笔回收</option>
              {viewModel.unresolvedClues.map((clue) => {
                const setupTitle = allScenes.find((scene) => scene.id === clue.setupSceneId)?.title ?? '未知场景';
                return <option key={clue.id} value={clue.id}>{`回收「${clue.title}」（埋于${setupTitle}）`}</option>;
              })}
            </select>
          </>
        )}
        <button onClick={submit}>{supportsInsertion ? '插入到时间线' : '添加到时间线'}</button>
      </div>
      {!supportsInsertion && <div className="legacy-hint">老项目沿用原有方式：新场景将追加到时间线末尾。</div>}
    </section>
  );
}
