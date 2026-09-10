from microevals_core.builtin_presets.loader import load_builtin_presets

def test_load_builtin_presets():
    suites = load_builtin_presets()
    assert len(suites) >= 24  # 20 Artificial Analysis + 4 Agent suites

    # Verify key official benchmarks are present
    slugs = {s.slug for s in suites}
    assert "strawberryeval-1750151694746" in slugs
    assert "p5js-physics-1749722945783" in slugs
    assert "racing-games-1750055917366" in slugs
    assert "svg-animals-1749936383078" in slugs
    assert "hackernews-clone-1749859153173" in slugs

    # Verify Agent benchmarks are present
    assert "agent-math-tools" in slugs
    assert "agent-sql-analyst" in slugs
    assert "agent-web-search" in slugs
    assert "agent-tool-abstention" in slugs

    # Verify total prompts count
    total_cases = sum(len(s.cases) for s in suites)
    assert total_cases >= 120

    # Verify StrawberryEval has prompts
    strawberry = next(s for s in suites if "strawberryeval" in s.slug)
    assert len(strawberry.cases) == 5
    assert any("strawberry" in c.prompt.lower() for c in strawberry.cases)
    assert strawberry.title_zh is not None
    assert strawberry.category == "Reasoning"
    assert strawberry.category_zh == "推理能力"

    # Verify Chinese-specific suites
    assert "chinese-logic-riddles" in slugs
    assert "chinese-agent-daily-tools" in slugs

    logic = next(s for s in suites if s.slug == "chinese-logic-riddles")
    assert logic.title_zh == "中文逻辑与经典脑筋急转弯"
    assert len(logic.cases) == 5
    assert all(c.prompt_zh for c in logic.cases)


def test_find_preset_bilingual():
    from microevals_core.builtin_presets.loader import find_preset

    # English query
    p_en = find_preset("strawberry")
    assert p_en is not None
    assert "strawberry" in p_en.slug

    # Chinese query
    p_zh = find_preset("脑筋急转弯")
    assert p_zh is not None
    assert p_zh.slug == "chinese-logic-riddles"

    # Chinese agent query
    p_agent = find_preset("日常生活工具")
    assert p_agent is not None
    assert p_agent.slug == "chinese-agent-daily-tools"
