export function viewOrcamentosTemplate() {
    return `
<section class="min-h-full flex flex-col fade-in relative hidden max-w-3xl mx-auto w-full" id="view-orcamentos" aria-live="polite">
    <div class="mb-4">
        <h2 class="text-xl font-bold mb-1">Orçamentos</h2>
        <p class="text-sm text-textSecondary">Defina quanto quer gastar por mês e acompanhe o quanto já usou.</p>
    </div>
    <div class="space-y-3" aria-busy="true">
        <div class="h-28 rounded-xl bg-surfaceLight/60 animate-pulse motion-reduce:animate-none"></div>
        <div class="h-20 rounded-xl bg-surfaceLight/60 animate-pulse motion-reduce:animate-none"></div>
    </div>
</section>`;
}
