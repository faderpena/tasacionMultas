document.addEventListener('DOMContentLoaded', () => {
    /* ------------------------------------------------------------------
       Asistente por pasos (5 pasos de captura + pantalla de resultados)
       ------------------------------------------------------------------ */
    const TOTAL_STEPS = 5;
    const STEP_NAMES = [
        'Beneficio Ilícito',
        'Temporalidad',
        'Afectación Ambiental',
        'Agravantes y Atenuantes',
        'Costos y Capacidad'
    ];

    let currentStep = 1;
    let maxReached = 1;          // paso más alto al que se puede saltar con clic
    const visited = new Set([1]); // pasos ya completados alguna vez

    const panels = Array.from(document.querySelectorAll('.step-panel[data-step]'));
    const stepItems = Array.from(document.querySelectorAll('#stepper .step'));
    const wizard = document.getElementById('wizard-progress');
    const progressFill = document.getElementById('progress-fill');
    const progressTrack = document.querySelector('.progress-track');
    const progressLabel = document.querySelector('.progress-label');
    const currentStepName = document.getElementById('current-step-name');
    const form = document.getElementById('taxation-form');
    const prevBtn = document.getElementById('prev-btn');
    const nextBtn = document.getElementById('next-btn');
    const calcularBtn = document.getElementById('calcular-btn');
    const resultsSection = document.getElementById('results-section');
    const backToFormBtn = document.getElementById('back-to-form-btn');
    const recalcularBtn = document.getElementById('recalcular-btn');
    const errorEl = document.getElementById('form-error');

    const tipoHechoSelect = document.getElementById('tipo-hecho');
    const groupDias = document.getElementById('group-dias');

    /* --- Utilidades de vista --------------------------------------- */

    function clearError() {
        errorEl.textContent = '';
        errorEl.classList.add('hidden');
    }

    function showError(msg) {
        errorEl.textContent = msg;
        errorEl.classList.remove('hidden');
    }

    function scrollToTop() {
        const y = wizard.getBoundingClientRect().top + window.pageYOffset - 16;
        window.scrollTo({ top: y, behavior: 'smooth' });
    }

    function paintStepper(n) {
        stepItems.forEach((li) => {
            const step = Number(li.dataset.step);
            const isActive = step === n;
            const isDone = visited.has(step) && step < n;
            const isUnlocked = step <= maxReached;

            li.classList.toggle('active', isActive);
            li.classList.toggle('done', isDone || (visited.has(step) && !isActive && step < maxReached));
            li.classList.toggle('locked', !isUnlocked);
            li.setAttribute('aria-disabled', isUnlocked ? 'false' : 'true');

            if (isActive) {
                li.setAttribute('aria-current', 'step');
            } else {
                li.removeAttribute('aria-current');
            }
        });
    }

    function renderStep(n) {
        currentStep = n;
        visited.add(n);
        if (n > maxReached) maxReached = n;

        panels.forEach((p) => {
            p.classList.toggle('active', Number(p.dataset.step) === n);
        });

        resultsSection.classList.add('hidden');
        form.classList.remove('hidden');

        progressLabel.innerHTML = `Paso <strong>${n}</strong> de ${TOTAL_STEPS}`;
        currentStepName.textContent = STEP_NAMES[n - 1];

        const pct = (n / TOTAL_STEPS) * 100;
        progressFill.style.width = pct + '%';
        progressTrack.setAttribute('aria-valuenow', String(n));
        progressTrack.setAttribute('aria-valuetext', `Paso ${n} de ${TOTAL_STEPS}: ${STEP_NAMES[n - 1]}`);

        paintStepper(n);

        prevBtn.disabled = n === 1;
        const last = n === TOTAL_STEPS;
        nextBtn.classList.toggle('hidden', last);
        calcularBtn.classList.toggle('hidden', !last);

        clearError();
    }

    function renderResults() {
        panels.forEach((p) => p.classList.remove('active'));
        form.classList.add('hidden');
        resultsSection.classList.remove('hidden');

        progressLabel.innerHTML = 'Resultados';
        currentStepName.textContent = 'Memoria de cálculo';
        progressFill.style.width = '100%';
        progressTrack.setAttribute('aria-valuenow', String(TOTAL_STEPS));
        progressTrack.setAttribute('aria-valuetext', 'Resultados');

        stepItems.forEach((li) => {
            const step = Number(li.dataset.step);
            li.classList.remove('active', 'locked');
            li.classList.toggle('done', step <= TOTAL_STEPS);
            li.removeAttribute('aria-current');
        });

        clearError();
    }

    /* --- Validación por paso --------------------------------------- */

    function labelFor(el) {
        const label = el.id ? document.querySelector(`label[for="${el.id}"]`) : null;
        if (!label) return el.id || 'campo';
        return label.textContent
            .replace(/\([^)]*\)/g, '')   // quita "($ COP)", "(p)", "($A_{grav}$)"
            .replace(/\s+/g, ' ')
            .trim()
            .replace(/:$/, '')
            .trim();
    }

    function validateStep(n) {
        const panel = panels.find((p) => Number(p.dataset.step) === n);
        if (!panel) return true;

        const fields = Array.from(panel.querySelectorAll('input, select'))
            .filter((el) => !el.disabled && el.offsetParent !== null);

        for (const el of fields) {
            if (!el.checkValidity()) {
                const v = el.validity;
                let reason = 'valor no válido';
                if (v.valueMissing) reason = 'es obligatorio';
                else if (v.badInput) reason = 'no es un número válido';
                else if (v.rangeUnderflow) reason = `debe ser mayor o igual a ${el.min}`;
                else if (v.rangeOverflow) reason = `debe ser menor o igual a ${el.max}`;
                else if (v.stepMismatch) reason = 'no coincide con el intervalo permitido';

                showError(`Revisa el paso ${n}: «${labelFor(el)}» ${reason}.`);
                el.focus();
                return false;
            }
        }
        clearError();
        return true;
    }

    /* --- Cálculo --------------------------------------------------- */

    function calcular() {
        // 1. Entradas
        const y1 = parseFloat(document.getElementById('y1').value) || 0;
        const y2 = parseFloat(document.getElementById('y2').value) || 0;
        const y3 = parseFloat(document.getElementById('y3').value) || 0;
        const p = parseFloat(document.getElementById('p').value) || 0.45;

        const tipoHecho = tipoHechoSelect.value;
        let alpha = 1.0;
        if (tipoHecho === 'continuo') {
            const d = parseInt(document.getElementById('dias').value, 10) || 1;
            alpha = (3.0 / 364.0) * d + (1.0 - (3.0 / 364.0));
            if (alpha > 4.0) alpha = 4.0;
        }

        const iVal = parseFloat(document.getElementById('i-value').value) || 1.0;
        const agravantes = parseFloat(document.getElementById('agravantes').value) || 0.0;
        const atenuantes = parseFloat(document.getElementById('atenuantes').value) || 0.0;
        const A = agravantes - atenuantes;

        const Ca = parseFloat(document.getElementById('ca').value) || 0;
        const Cs = parseFloat(document.getElementById('cs').value) || 0.75;
        const smmlv = parseFloat(document.getElementById('smmlv').value) || 1750905; // SMMLV 2026

        // 2. Beneficio Ilícito (B) con topes legales
        const Y_total = y1 + y2 + y3;
        let B = Y_total * ((1.0 - p) / p);

        if (tipoHecho === 'instantaneo') {
            const topeB = 5000 * smmlv;
            if (B > topeB) B = topeB;
        } else {
            const topeB = 2 * ((alpha * iVal) * (1 + A) + Ca) * Cs;
            if (B > topeB) B = topeB;
        }

        // 3. Modelo: Multa = B + [ (alpha * i) * (1 + A) + Ca ] * Cs
        const terminoCentral = ((alpha * iVal) * (1 + A)) + Ca;
        let multaTotal = B + (terminoCentral * Cs);
        if (multaTotal < 0) multaTotal = 0;

        // 4. Salida formateada en COP
        const formatter = new Intl.NumberFormat('es-CO', {
            style: 'currency',
            currency: 'COP',
            maximumFractionDigits: 2
        });

        document.getElementById('res-b').textContent = formatter.format(B);
        document.getElementById('res-alpha').textContent = alpha.toFixed(4);
        document.getElementById('res-a').textContent = (1 + A).toFixed(2);
        document.getElementById('res-total').textContent = formatter.format(multaTotal);
    }

    /* --- Eventos --------------------------------------------------- */

    nextBtn.addEventListener('click', () => {
        if (!validateStep(currentStep)) return;
        if (currentStep < TOTAL_STEPS) renderStep(currentStep + 1);
    });

    prevBtn.addEventListener('click', () => {
        if (currentStep > 1) renderStep(currentStep - 1);
    });

    document.getElementById('stepper').addEventListener('click', (e) => {
        const li = e.target.closest('.step');
        if (!li) return;
        const step = Number(li.dataset.step);
        if (step > maxReached || step === currentStep) return;
        if (step > currentStep && !validateStep(currentStep)) return;
        renderStep(step);
    });

    calcularBtn.addEventListener('click', () => {
        if (!validateStep(TOTAL_STEPS)) return;
        calcular();
        renderResults();
        resultsSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });

    backToFormBtn.addEventListener('click', () => {
        renderStep(TOTAL_STEPS);
        scrollToTop();
    });

    recalcularBtn.addEventListener('click', () => {
        calcular();
        resultsSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });

    // Enter = avanzar (o calcular en el último paso)
    form.addEventListener('keydown', (e) => {
        if (e.key !== 'Enter' || e.target.tagName === 'TEXTAREA') return;
        e.preventDefault();
        if (currentStep < TOTAL_STEPS) {
            if (validateStep(currentStep)) renderStep(currentStep + 1);
        } else {
            calcularBtn.click();
        }
    });

    // Mostrar u ocultar el campo de días según el tipo de hecho
    tipoHechoSelect.addEventListener('change', (e) => {
        groupDias.style.display = e.target.value === 'continuo' ? 'flex' : 'none';
    });

    renderStep(1);
});
