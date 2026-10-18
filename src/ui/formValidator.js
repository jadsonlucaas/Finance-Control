/**
 * Lightweight schema-based form validator and parser.
 */

export function extractFormData(formElement) {
    const formData = new FormData(formElement);
    const data = Object.fromEntries(formData.entries());
    
    // Fallback: If elements don't have name attributes but have IDs
    // we can extract them manually for legacy compatibility
    Array.from(formElement.elements).forEach(el => {
        if (!el.name && el.id) {
            if (el.type === 'checkbox') {
                data[el.id] = el.checked;
            } else {
                data[el.id] = el.value;
            }
        }
        if (el.name && el.type === 'checkbox') {
            data[el.name] = el.checked;
        }
    });

    return data;
}

export function validateSchema(data, schema) {
    const errors = {};
    const validatedData = {};

    for (const [key, rules] of Object.entries(schema)) {
        let value = data[key];

        // Type coercion
        if (rules.type === 'number') {
            value = value ? Number(value) : (rules.required ? NaN : null);
        } else if (rules.type === 'boolean') {
            value = Boolean(value);
        } else if (rules.type === 'string') {
            value = value ? String(value).trim() : '';
        }

        // Required check
        if (rules.required && (value === undefined || value === null || value === '' || (rules.type==='number' && isNaN(value)))) {
            errors[key] = rules.message || 'Campo obrigatório';
            continue;
        }

        // Min check
        if (rules.min !== undefined && value < rules.min) {
            errors[key] = rules.message || \`Valor mínimo é \${rules.min}\`;
        }

        validatedData[key] = value;
    }

    return {
        isValid: Object.keys(errors).length === 0,
        errors,
        data: validatedData
    };
}
