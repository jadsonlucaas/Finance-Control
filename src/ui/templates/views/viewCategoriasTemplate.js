export function viewCategoriasTemplate() {
  return `
<!-- CATEGORIAS -->
            <section id="view-categorias" class="fade-in hidden max-w-2xl mx-auto">
                <div id="category-modal" class="hidden fixed inset-0 bg-black/60 flex items-center justify-center z-[90]">
                    <div class="bg-surface rounded-xl p-5 border border-surfaceLight max-w-sm mx-4 w-full">
                        <h3 id="category-modal-title" class="font-semibold mb-4">Nova Categoria</h3>
                        <div class="space-y-3">
                            <div>
                                <label class="text-xs text-textSecondary mb-1 block">Nome</label><input id="cat-name"
                                    type="text" placeholder="Ex: Alimentação" class="w-full text-sm">
                            </div>
                            <div id="cat-scope-wrap">
                                <label class="text-xs text-textSecondary mb-1 block">Escopo</label>
                                <select id="cat-scope" class="w-full text-sm">
                                    <option value="personal">Pessoal</option>
                                    <option value="global">Global</option>
                                </select>
                                <p class="text-xs text-textSecondary mt-1">Global afeta todos os usuarios e exige autorizacao administrativa.</p>
                            </div>
                            <div>
                                <label class="text-xs text-textSecondary mb-1 block">Macro Categoria</label><select
                                    id="cat-macro" class="w-full text-sm">
                                    <option value="FIXO">Fixo</option>
                                    <option value="VARIAVEL">Variável</option>
                                    <option value="RESERVA">Reserva</option>
                                </select>
                            </div>
                            <div>
                                <label class="text-xs text-textSecondary mb-1 block">Cor</label>
                                <div class="flex gap-2 flex-wrap">
                                    <button id="btn-select-color-cyan" type="button"
                                        class="w-8 h-8 rounded bg-cyan-500 border-2 border-textSecondary"></button><button
                                        id="btn-select-color-emerald" type="button"
                                        class="w-8 h-8 rounded bg-emerald-400 border-2 border-textSecondary"></button><button
                                        id="btn-select-color-amber" type="button"
                                        class="w-8 h-8 rounded bg-amber-400 border-2 border-textSecondary"></button><button
                                        id="btn-select-color-rose" type="button"
                                        class="w-8 h-8 rounded bg-rose-500 border-2 border-textSecondary"></button><button
                                        id="btn-select-color-violet" type="button"
                                        class="w-8 h-8 rounded bg-violet-400 border-2 border-textSecondary"></button><button
                                        id="btn-select-color-pink" type="button"
                                        class="w-8 h-8 rounded bg-pink-500 border-2 border-textSecondary"></button>
                                </div><input id="cat-color" type="hidden" value="#38bdf8">
                            </div>
                            <div>
                                <label class="text-xs text-textSecondary mb-1 block">Icone (nome Lucide)</label><input
                                    id="cat-icon" type="text" placeholder="Ex: shopping-bag..." class="w-full text-sm"
                                    value="tag">
                            </div>
                        </div>
                        <div class="flex gap-2 justify-end mt-5">
                            <button id="btn-close-category-form" type="button"
                                class="px-3 py-1.5 text-sm text-textSecondary bg-surfaceLight rounded-lg">Cancelar</button><button
                                id="category-save-button" type="button"
                                class="px-3 py-1.5 text-sm text-white bg-accent rounded-lg">Salvar</button>
                        </div>
                    </div>
                </div>
            </section>`;
}
