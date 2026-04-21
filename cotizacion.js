'use strict';

document.addEventListener('DOMContentLoaded', () => {
    const form = document.getElementById('propuestaForm');
    if(!form) return;
    const submitBtn = form.querySelector('#btnGenerarDocx');
    const docxLoader = document.getElementById('docxLoader');
    const rowsBody = document.getElementById('cotizacionRows');
    const addRowBtn = document.getElementById('agregarFilaCotizacion');
    const formatPeso = (v) => {
        const num = parseInt((v || '').replace(/\D/g, '')); 
        if (isNaN(num)) return '';
        return '$' + num.toLocaleString('es-CL') + '.-';
    };
    const buildRow = (idx, data = {}) => {
        const tr = document.createElement('tr');
        tr.className = 'cot-row';
        tr.dataset.idx = String(idx);
        tr.innerHTML = `
          <td><input type="text" name="concepto${idx}" placeholder="Concepto ${idx}" value="${data.concepto || ''}"></td>
          <td><input type="text" name="fijo${idx}" class="fijo" value="${data.fijo || ''}"></td>
          <td><input type="text" name="variable${idx}" value="${data.variable || ''}"></td>
          <td><button type="button" class="mini-boton cot-remove">🗑</button></td>
        `;
        return tr;
    };

    const renumerarRows = () => {
        if (!rowsBody) return;
        Array.from(rowsBody.querySelectorAll('tr.cot-row')).forEach((tr, i) => {
            const idx = i + 1;
            tr.dataset.idx = String(idx);
            tr.querySelector('input[name^="concepto"]').setAttribute('name', `concepto${idx}`);
            tr.querySelector('input[name^="concepto"]').setAttribute('placeholder', `Concepto ${idx}`);
            tr.querySelector('input[name^="fijo"]').setAttribute('name', `fijo${idx}`);
            tr.querySelector('input[name^="variable"]').setAttribute('name', `variable${idx}`);
        });
    };

    if (rowsBody) {
        rowsBody.innerHTML = '';
        rowsBody.appendChild(buildRow(1));
        rowsBody.addEventListener('click', (e) => {
            const btn = e.target.closest('.cot-remove');
            if (!btn) return;
            const all = rowsBody.querySelectorAll('tr.cot-row');
            if (all.length <= 1) return;
            btn.closest('tr')?.remove();
            renumerarRows();
        });
    }
    if (addRowBtn && rowsBody) {
        addRowBtn.addEventListener('click', () => {
            const idx = rowsBody.querySelectorAll('tr.cot-row').length + 1;
            rowsBody.appendChild(buildRow(idx));
        });
    }
    form.addEventListener('blur', (e) => {
        const inp = e.target;
        if (!(inp instanceof HTMLInputElement) || !inp.classList.contains('fijo')) return;
        inp.value = formatPeso(inp.value);
    }, true);
    form.addEventListener('focus', (e) => {
        const inp = e.target;
        if (!(inp instanceof HTMLInputElement) || !inp.classList.contains('fijo')) return;
        inp.value = inp.value.replace(/[^0-9]/g,'');
    }, true);

    // Solo se necesita PizZip para reemplazar etiquetas en el DOCX
    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        if(submitBtn) submitBtn.disabled = true;
        if(docxLoader) docxLoader.classList.remove('oculto');
        const datos = Object.fromEntries(new FormData(form).entries());
        const usuario = JSON.parse(localStorage.getItem('usuarioActual') || '{}');
        if (!datos.fecha) {
            datos.fecha = new Date().toISOString().slice(0, 10);
        }

        const cotizacion = Array.from(form.querySelectorAll('#cotizacionRows tr.cot-row')).map((tr) => {
            const idx = tr.dataset.idx;
            return {
                concepto: datos[`concepto${idx}`] || '',
                fijo: datos[`fijo${idx}`] || '',
                variable: datos[`variable${idx}`] || ''
            };
        }).filter((c) => c.concepto || c.fijo || c.variable);

        try {
            let numero = 0;
            if (window.supabaseSync?.nextQuoteNumber) {
                numero = await window.supabaseSync.nextQuoteNumber(290);
            }
            if (!Number.isFinite(numero) || numero < 290) {
                throw new Error('No se pudo obtener correlativo desde base de datos');
            }

            const propuestas = JSON.parse(localStorage.getItem('propuestas')) || [];
            const propuesta = { ...datos, cotizacion, numero };
            propuestas.push(propuesta);
            localStorage.setItem('propuestas', JSON.stringify(propuestas));

            const fechaParts = datos.fecha ? datos.fecha.split('-') : [];
            const fechaFormateada =
                fechaParts.length === 3
                    ? `${fechaParts[2]}-${fechaParts[1]}-${fechaParts[0]}`
                    : datos.fecha;
            let resumen = datos.servicio ? datos.servicio.trim() : '';
            if (resumen.endsWith('.')) resumen = resumen.slice(0, -1);
            const detalleCotizacion = cotizacion
                .map((c, i) => `${i + 1}) ${c.concepto || '-'} | ${c.fijo || '-'} | ${c.variable || '-'}`)
                .join('\n');

            const replacements = {
                '\\[Nombre cliente\\]': datos.nombre,
                '\\[Mail\\]': datos.mail,
                '\\[Materia\\]': datos.materia,
                '\\[Fecha\\]': fechaFormateada,
                '\\[Servicio requerido\\]': resumen,
                '\\[Propuesta de servicio\\]': datos.propuesta,
                '\\[Detalle cotización\\]': detalleCotizacion,
                '\\[N\u00famero\\]': numero,
                '\\[Numero\\]': numero,
                '\\[Usuario\\]': usuario.usuario || usuario.nombre || ''
            };

            cotizacion.forEach((c, i) => {
                replacements[`\\[Concepto ${i + 1}\\]`] = c.concepto || '';
                replacements[`\\[Fijo ${i + 1}\\]`] = c.fijo;
                replacements[`\\[Variable ${i + 1}\\]`] = c.variable;
            });

            const resp = await fetch('templatepropuesta.docx');
            if(!resp.ok) throw new Error('template_missing');
            const buffer = await resp.arrayBuffer();
            const zip = new PizZip(buffer);
            let docXml = zip.file('word/document.xml').asText();
            for (const [pattern, value] of Object.entries(replacements)) {
                docXml = docXml.replace(new RegExp(pattern, 'g'), value || '');
            }
            zip.file('word/document.xml', docXml);
            const blob = zip.generate({type:'blob', mimeType:'application/vnd.openxmlformats-officedocument.wordprocessingml.document'});
            const link = document.createElement('a');
            link.href = URL.createObjectURL(blob);
            link.download = `N${numero} ${datos.nombre}.docx`;
            document.body.appendChild(link);
            link.click();
            if (window.mostrarAlertaModal) {
                window.mostrarAlertaModal(
                    'Cotizaci\u00f3n generada satisfactoriamente. \u00a1Recuerda subirla a <strong>Google Drive</strong>!',
                    'https://drive.google.com/drive/folders/1FBctJ8BlyM6twOBn_xRw8R_mW8xsqBPj'
                );
            }
            setTimeout(() => {
                URL.revokeObjectURL(link.href);
                document.body.removeChild(link);
            }, 100);

            form.reset();
            if (rowsBody) {
                rowsBody.innerHTML = '';
                rowsBody.appendChild(buildRow(1));
            }
        } catch (err) {
            console.error(err);
            const msg = String(err?.message || "");
            if (window.mostrarToast) {
                window.mostrarToast(
                    msg.includes('correlativo')
                        ? 'No se pudo obtener el correlativo desde base de datos.'
                        : 'No se pudo generar el DOCX.',
                    '#e53935'
                );
            } else {
                alert(msg.includes('correlativo')
                    ? 'No se pudo obtener el correlativo desde base de datos.'
                    : 'No se pudo generar el DOCX.');
            }
        } finally {
            if(submitBtn) submitBtn.disabled = false;
            if(docxLoader) docxLoader.classList.add('oculto');
        }
    });
});
