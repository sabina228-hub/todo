// 할 일 목록: 추가 · 완료 체크 · 수정 · 삭제 · 필터. 데이터는 localStorage에 저장

// file://로 연 페이지는 모두 같은 localStorage를 쓰므로, 다른 앱과 겹치지 않는 키 이름을 씀
const STORAGE_KEY = "todo-list:v1";

// 필터별로 보여 줄 할 일을 고르는 함수
const FILTERS = {
  all: () => true,
  active: (todo) => !todo.done,
  done: (todo) => todo.done,
};

const EMPTY_MESSAGES = {
  all: "할 일이 없어요. 위에서 새 할 일을 추가해 보세요.",
  active: "남은 할 일이 없어요.",
  done: "완료한 할 일이 없어요.",
};

const state = {
  todos: [],       // { id, text, done } 목록. 이것만 저장함
  filter: "all",   // 저장하지 않으므로 새로 열면 항상 "전체"
  editingId: null, // 수정 중인 할 일의 id
};

const $ = (id) => document.getElementById(id);

const els = {
  saveError: $("save-error"),
  form: $("todo-form"),
  input: $("todo-input"),
  filterButtons: document.querySelectorAll(".filter-btn"),
  list: $("todo-list"),
  empty: $("empty-message"),
  footer: $("todo-footer"),
  remaining: $("remaining-count"),
  clearDone: $("clear-done-btn"),
};

/* ---------- 저장 ---------- */

// 저장된 값이 없거나 깨졌으면 빈 목록으로 시작하고, 형식이 맞지 않는 항목은 버림
function load() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
    if (Array.isArray(saved)) state.todos = saved.filter(isValidTodo);
  } catch {
    // 깨진 값은 무시
  }
}

function isValidTodo(todo) {
  return Boolean(todo)
    && typeof todo.id === "string"
    && typeof todo.text === "string"
    && todo.text.trim() !== ""
    && typeof todo.done === "boolean";
}

// 저장에 실패해도(저장 공간 부족, 브라우저 설정 등) 앱은 계속 쓸 수 있게 안내만 띄움
function save() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state.todos));
    els.saveError.hidden = true;
  } catch {
    els.saveError.hidden = false;
  }
}

/* ---------- 상태 변경 ---------- */

// 상태를 바꾸는 동작은 모두 여기를 거침: 열린 수정 칸 마무리 → 바꾸기 → 저장 → 다시 그리기
function update(change) {
  finishPendingEdit();
  change();
  save();
  render();
}

function addTodo(text) {
  update(() => {
    state.todos.unshift({ id: createId(), text, done: false });
    // "완료" 필터에서는 새 할 일이 안 보이므로 "전체"로 바꿈
    if (state.filter === "done") state.filter = "all";
  });
}

function toggleTodo(id) {
  update(() => {
    const todo = findTodo(id);
    todo.done = !todo.done;
  });
}

function deleteTodo(id) {
  update(() => {
    state.todos = state.todos.filter((todo) => todo.id !== id);
  });
}

function clearDone() {
  update(() => {
    state.todos = state.todos.filter((todo) => !todo.done);
  });
}

function setFilter(filter) {
  update(() => {
    state.filter = filter;
  });
}

/* ---------- 수정 ---------- */
// 수정을 시작하고 끝낼 때는 목록 전체가 아니라 그 줄만 바꿔 끼움.
// 전체를 다시 그리면, 수정 칸을 벗어나며 누른 다른 줄의 버튼(또는 Tab으로 옮겨 간 칸)이 사라져 버리기 때문

function startEdit(id) {
  finishPendingEdit();
  state.editingId = id;
  const li = createEditItem(findTodo(id));
  findItemElement(id).replaceWith(li);
  const input = li.querySelector(".edit-input");
  input.focus();
  input.select();
}

// newText가 null이면 취소. 비어 있으면 원래 내용을 그대로 둠
function endEdit(newText, returnFocus) {
  const id = state.editingId;
  if (id === null) return; // 이미 끝남 (Enter로 끝내며 수정 칸을 지울 때 blur가 한 번 더 올 수 있음)
  state.editingId = null;

  const todo = findTodo(id);
  const text = newText === null ? "" : newText.trim();
  if (text !== "" && text !== todo.text) {
    todo.text = text;
    save();
  }

  const li = createTodoItem(todo);
  findItemElement(id).replaceWith(li);
  if (returnFocus) li.querySelector('[data-action="edit"]').focus();
}

// 수정 칸이 열린 채로 다른 동작을 하면 먼저 저장하고 닫음.
// 보통은 blur 때 이미 끝나 있지만, 클릭해도 포커스가 옮겨지지 않는 브라우저가 있어서 한 번 더 확인함
function finishPendingEdit() {
  const input = els.list.querySelector(".edit-input");
  if (input) endEdit(input.value, false);
}

/* ---------- 화면 그리기 ---------- */

// 목록은 매번 새로 만듦. 키보드로 쓰던 위치를 잃지 않게 포커스를 기억했다가 되돌림
function render() {
  const focusSpot = getFocusSpot();

  const visible = state.todos.filter(FILTERS[state.filter]);
  els.list.replaceChildren(...visible.map(createTodoItem));
  els.empty.textContent = EMPTY_MESSAGES[state.filter];
  els.empty.hidden = visible.length > 0;

  const doneCount = state.todos.filter((todo) => todo.done).length;
  els.remaining.textContent = `남은 할 일 ${state.todos.length - doneCount}개`;
  els.clearDone.hidden = doneCount === 0;
  els.footer.hidden = state.todos.length === 0;

  els.filterButtons.forEach((button) => {
    button.setAttribute("aria-pressed", String(button.dataset.filter === state.filter));
  });

  restoreFocus(focusSpot);
}

// 일반 줄: [체크박스 + 내용] [수정] [삭제]
function createTodoItem(todo) {
  const li = document.createElement("li");
  li.className = todo.done ? "todo-item is-done" : "todo-item";
  li.dataset.id = todo.id;

  // label로 감싸서 글자를 눌러도 체크됨
  const label = document.createElement("label");
  label.className = "todo-label";

  const checkbox = document.createElement("input");
  checkbox.type = "checkbox";
  checkbox.className = "todo-check";
  checkbox.checked = todo.done;
  checkbox.dataset.action = "toggle";

  const text = document.createElement("span");
  text.className = "todo-text";
  text.textContent = todo.text; // 사용자 입력은 항상 textContent로 넣음

  label.append(checkbox, text);
  li.append(label, createItemButton("수정", "edit", todo.text), createItemButton("삭제", "delete", todo.text));
  return li;
}

// 수정 중인 줄: 입력 칸 하나
function createEditItem(todo) {
  const li = document.createElement("li");
  li.className = "todo-item";
  li.dataset.id = todo.id;

  const input = document.createElement("input");
  input.type = "text";
  input.className = "edit-input";
  input.value = todo.text;
  input.maxLength = 100;
  input.setAttribute("aria-label", "할 일 수정");

  li.append(input);
  return li;
}

// 화면에는 "수정"만 보이지만, 화면 낭독기는 "장보기 수정"처럼 어떤 할 일인지 함께 읽음
function createItemButton(label, action, todoText) {
  const button = document.createElement("button");
  button.type = "button";
  button.className = action === "delete" ? "text-btn text-btn--danger" : "text-btn";
  button.dataset.action = action;
  button.textContent = label;
  button.setAttribute("aria-label", `${todoText} ${label}`);
  return button;
}

/* ---------- 포커스 유지 (키보드 사용자용) ---------- */

// 포커스가 목록 안에 있으면 어느 줄의 어떤 컨트롤(data-action)인지 기억
function getFocusSpot() {
  const el = document.activeElement;
  const li = el ? el.closest(".todo-item") : null;
  if (!li) return null;
  return { id: li.dataset.id, action: el.dataset.action, index: [...els.list.children].indexOf(li) };
}

// 같은 줄의 같은 컨트롤로 되돌림. 그 줄이 사라졌으면(삭제, 필터) 그 자리에 온 줄로
function restoreFocus(spot) {
  if (!spot) return;
  const items = els.list.children;
  const li = findItemElement(spot.id) || items[Math.min(spot.index, items.length - 1)];
  const target = li ? li.querySelector(`[data-action="${spot.action}"]`) : null;
  if (target) target.focus();
}

/* ---------- 도우미 ---------- */

function findTodo(id) {
  return state.todos.find((todo) => todo.id === id);
}

function findItemElement(id) {
  return [...els.list.children].find((li) => li.dataset.id === id);
}

function getItemId(el) {
  return el.closest(".todo-item").dataset.id;
}

function createId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

/* ---------- 이벤트 ---------- */

els.form.addEventListener("submit", (event) => {
  event.preventDefault();
  const text = els.input.value.trim();
  els.input.value = "";
  if (text) addTodo(text);
});

els.filterButtons.forEach((button) => {
  button.addEventListener("click", () => setFilter(button.dataset.filter));
});

els.clearDone.addEventListener("click", () => {
  const count = state.todos.filter((todo) => todo.done).length;
  if (confirm(`완료한 할 일 ${count}개를 삭제할까요?`)) clearDone();
});

// 목록의 줄은 계속 새로 만들어지므로, 이벤트는 목록(ul) 하나에서 받음
els.list.addEventListener("change", (event) => {
  if (event.target.dataset.action === "toggle") toggleTodo(getItemId(event.target));
});

els.list.addEventListener("click", (event) => {
  const button = event.target.closest("button[data-action]");
  if (!button) return;
  const id = getItemId(button);
  if (button.dataset.action === "edit") startEdit(id);
  else if (button.dataset.action === "delete") deleteTodo(id);
});

els.list.addEventListener("keydown", (event) => {
  if (!event.target.matches(".edit-input")) return;
  if (event.isComposing) return; // 한글 조합 중에 누른 Enter는 글자 확정용이므로 무시
  if (event.key === "Enter") endEdit(event.target.value, true);
  else if (event.key === "Escape") endEdit(null, true);
});

// 수정 칸 밖을 누르거나 Tab으로 벗어나면 저장
els.list.addEventListener("focusout", (event) => {
  if (event.target.matches(".edit-input")) endEdit(event.target.value, false);
});

load();
render();
