import { useState } from 'react';
import type { StoryScene } from '../models/story';
import type { SceneInsertPosition } from '../models/storyRules';
import type { StoryViewModel } from '../viewmodels/storyViewModel';

interface TimelineBoardProps { viewModel: StoryViewModel; scenes: StoryScene[]; }

export function TimelineBoard({ viewModel, scenes }: TimelineBoardProps) {
  const story = viewModel.snapshot.story;
  const allScenes = story ? [...story.scenes].sort((a, b) => a.order - b.order) : [];
  const [title, setTitle] = useState('');
  const [summary, setSummary] = useState('');
  const [position, setPosition] = useState<SceneInsertPosition>('end');
  const [anchorSceneId, setAnchorSceneId] = useState('');

  const submit = () => {
    // 接在时间线末尾仍走原来的新建路径，行为与以前完全一致
    if (position === 'end') {
      viewModel.addScene(title, summary);
    } else {
      viewModel.insertScene(title, summary, { position, anchorSceneId });
    }
    setTitle('');
    setSummary('');
  };

  const quickInsert = (quickPosition: 'start' | 'before' | 'after', sceneId?: string) => {
    setPosition(quickPosition);
    setAnchorSceneId(sceneId ?? '');
  };

  const anchorSelected = position === 'before' || position === 'after';
  const canSubmit = title.trim().length >= 2 && (!anchorSelected || Boolean(anchorSceneId));

  return (
    <section className="panel timeline-panel">
      <div className="panel-heading timeline-heading"><div><span className="eyebrow">SEQUENCE / 时间结构</span><h2>故事时间线</h2></div><div className="timeline-actions"><span className="hint">拖动感受节奏 · 点击编辑详情</span><button className="secondary-button" onClick={submit}>＋ 新建场景</button></div></div>
      {viewModel.timelineWarning && <div className="warning-banner">△ {viewModel.timelineWarning}</div>}
      <div className="timeline-rail">
        {scenes.map((scene, index) => {
          const selected = story?.selectedSceneId === scene.id;
          const characterCount = story?.characters.filter((character) => scene.characterIds.includes(character.id)).length ?? 0;
          return <div className={selected ? 'scene-node selected' : 'scene-node'} key={scene.id} role="button" tabIndex={0} onClick={() => viewModel.selectScene(scene.id)} onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); viewModel.selectScene(scene.id); } }}><span className="scene-index">{String(index + 1).padStart(2, '0')}</span><span className="scene-line" /><span className="scene-dot" /><div className="scene-copy"><div className="scene-quick-insert"><button type="button" title={`插到「${scene.title}」之前`} onClick={(event) => { event.stopPropagation(); quickInsert('before', scene.id); }}>↑ 前插</button>{index === 0 && <button type="button" title="放到时间线开头" onClick={(event) => { event.stopPropagation(); quickInsert('start'); }}>⇤ 开头</button>}<button type="button" title={`接到「${scene.title}」之后`} onClick={(event) => { event.stopPropagation(); quickInsert('after', scene.id); }}>后插 ↓</button></div><span className="scene-meta">SCENE {String(index + 1).padStart(2, '0')} · {characterCount} 位人物</span><strong>{scene.title}</strong><span>{scene.summary}</span><div className="scene-tags">{scene.conflict && <em>冲突</em>}{scene.clueIds.length > 0 && <em className="clue-tag">伏笔 {scene.clueIds.length}</em>}</div></div></div>;
        })}
        {scenes.length === 0 && <div className="empty-state">时间线还没有场景。创建第一幕，让故事开始移动。</div>}
      </div>
      <div className="create-scene-row"><input aria-label="场景标题" value={title} onChange={(event) => setTitle(event.target.value)} placeholder="新场景标题，例如：灯塔停电" /><input aria-label="场景摘要" value={summary} onChange={(event) => setSummary(event.target.value)} placeholder="一句话写下这一幕发生了什么" /><select aria-label="插入位置" value={position} onChange={(event) => setPosition(event.target.value as SceneInsertPosition)}><option value="end">接到时间线结尾</option><option value="start">放到时间线开头</option><option value="after">接到某一幕之后</option><option value="before">插到某一幕之前</option></select>{anchorSelected && <select aria-label="参照场景" value={anchorSceneId} onChange={(event) => setAnchorSceneId(event.target.value)}><option value="">选择参照的一幕…</option>{allScenes.map((scene) => <option key={scene.id} value={scene.id}>第 {scene.order} 幕 · {scene.title}</option>)}</select>}<button onClick={submit} disabled={!canSubmit}>{position === 'end' ? '添加到时间线' : '插入到时间线'}</button></div>
    </section>
  );
}
