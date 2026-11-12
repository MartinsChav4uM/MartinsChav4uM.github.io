/* Página de download: escolhe a aba do sistema (Windows ou Mac) e aponta cada botão para o instalador da última release do GitHub. */
(() => {
  'use strict';
  const raiz = document.getElementById('baixar');
  if (!raiz) return;
  document.getElementById('year').textContent = new Date().getFullYear();

  /* ---------- Abas: ?so=mac / ?so=windows, ou o sistema de quem está visitando ---------- */
  const abas = [...raiz.querySelectorAll('.so-abas [role="tab"]')];
  const paineis = [...raiz.querySelectorAll('.so-painel')];
  const pedido = new URLSearchParams(location.search).get('so');
  const detectado = /Mac|iPhone|iPad/i.test(navigator.platform || navigator.userAgent) ? 'mac' : 'windows';
  const valido = so => (so === 'mac' || so === 'windows' ? so : null);

  function mostrar(so, mexerNoEndereco) {
    abas.forEach(a => {
      const ativa = a.dataset.so === so;
      a.setAttribute('aria-selected', ativa);
      a.tabIndex = ativa ? 0 : -1;
    });
    paineis.forEach(p => { p.hidden = p.dataset.so !== so; });
    if (mexerNoEndereco) history.replaceState(null, '', `?so=${so}`);
  }

  abas.forEach((aba, i) => {
    aba.addEventListener('click', () => mostrar(aba.dataset.so, true));
    aba.addEventListener('keydown', e => {
      if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
      const outra = abas[(i + (e.key === 'ArrowRight' ? 1 : abas.length - 1)) % abas.length];
      outra.focus();
      mostrar(outra.dataset.so, true);
    });
  });
  mostrar(valido(pedido) || detectado, false);

  /* ---------- Download: sempre o instalador da última release ---------- */
  const repo = raiz.dataset.repo;
  const blocos = [...raiz.querySelectorAll('.download[data-arquivo]')];
  const liberar = (botao, href, texto) => { botao.href = href; botao.textContent = texto; botao.removeAttribute('aria-disabled'); };

  fetch(`https://api.github.com/repos/${repo}/releases/latest`, { headers: { Accept: 'application/vnd.github+json' } })
    .then(r => (r.status === 404 ? null : r.ok ? r.json() : Promise.reject(r.status)))
    .then(rel => {
      blocos.forEach(bloco => {
        const arquivo = bloco.dataset.arquivo;
        const botao = bloco.querySelector('[data-botao]'), info = bloco.querySelector('[data-info]');
        const sistema = arquivo.endsWith('.dmg') ? 'Mac' : 'Windows';
        const asset = rel && (rel.assets || []).find(a => a.name === arquivo);
        if (!asset) {
          botao.textContent = `Versão para ${sistema} em breve`;
          info.textContent = `A versão para ${sistema} ainda está sendo publicada. Volte em breve.`;
          return;
        }
        const versao = rel.tag_name.replace(/^v/i, '');
        const mb = (asset.size / 1048576).toFixed(0);
        const data = new Date(rel.published_at).toLocaleDateString('pt-BR');
        // O texto da release traz um código de verificação por arquivo: "SHA-256 (Mac): ..." ou "SHA-256: ..." (Windows).
        const marca = sistema === 'Mac' ? /SHA-256\s*\(Mac\):\s*([0-9a-f]{64})/i : /SHA-256(?:\s*\(Windows\))?:\s*([0-9a-f]{64})/i;
        const sha = (rel.body || '').match(marca);
        liberar(botao, asset.browser_download_url, `Baixar para ${sistema} (versão ${versao})`);
        const requisito = info.textContent;
        info.textContent = `Versão ${versao} · ${mb} MB · publicada em ${data}. ${requisito}`;
        if (sha) {
          const linha = document.createElement('small');
          linha.append('Código de verificação (SHA-256): ');
          const codigo = document.createElement('code');
          codigo.textContent = sha[1].toLowerCase();
          linha.append(codigo);
          info.append(document.createElement('br'), linha);
        }
      });
    })
    .catch(() => { // GitHub fora do ar ou bloqueado: o link "latest" sempre aponta para o instalador mais novo
      blocos.forEach(bloco => {
        const arquivo = bloco.dataset.arquivo;
        const sistema = arquivo.endsWith('.dmg') ? 'Mac' : 'Windows';
        liberar(bloco.querySelector('[data-botao]'), `https://github.com/${repo}/releases/latest/download/${arquivo}`, `Baixar para ${sistema}`);
      });
    })
    .finally(() => {
      // As informações da versão mudam a altura do topo: quem veio por um link (#cadastro, do app) continua no lugar certo.
      const alvo = location.hash.length > 1 && document.getElementById(location.hash.slice(1));
      if (alvo && !rolouSozinho) alvo.scrollIntoView();
    });
  let rolouSozinho = false;
  ['wheel', 'touchmove', 'keydown'].forEach(ev => addEventListener(ev, () => { rolouSozinho = true; }, { once: true, passive: true }));

  /* ---------- Contato de suporte (um lugar só: data-whatsapp e data-email no <main>) ---------- */
  const caixaContato = document.getElementById('contato-botoes');
  if (caixaContato) {
    const whats = (raiz.dataset.whatsapp || '').replace(/\D/g, '');
    const email = (raiz.dataset.email || '').trim();
    const botao = (href, texto) => {
      const a = document.createElement('a');
      a.className = 'btn btn-ghost'; a.href = href; a.textContent = texto;
      if (href.startsWith('http')) { a.target = '_blank'; a.rel = 'noopener'; }
      caixaContato.append(a);
    };
    if (whats) botao(`https://wa.me/${whats}?text=${encodeURIComponent('Olá! Preciso de ajuda com o Gestão Fotográfica.')}`, 'WhatsApp');
    if (email) botao(`mailto:${email}?subject=${encodeURIComponent('Gestão Fotográfica')}`, email);
    if (!whats && !email) document.getElementById('contato').hidden = true;
  }

  /* ---------- Cadastro: manda para o servidor de ativação e mostra o código na hora ---------- */
  const form = document.getElementById('form-cadastro');
  if (!form) return;
  const enviar = document.getElementById('form-enviar');
  const caixaErro = document.getElementById('form-erro');
  const pronto = document.getElementById('codigo-pronto');
  const textoBotao = enviar.textContent;

  const mostrarErro = (texto, campo) => {
    caixaErro.textContent = texto;
    caixaErro.hidden = !texto;
    form.querySelectorAll('[aria-invalid]').forEach(c => c.removeAttribute('aria-invalid'));
    if (campo) { campo.setAttribute('aria-invalid', 'true'); campo.focus(); }
  };
  // Mesmo critério do servidor: 10 ou 11 dígitos com DDD (o +55 do começo é aceito).
  const digitosWhats = v => { let d = v.replace(/\D/g, ''); if (d.length >= 12 && d.startsWith('55')) d = d.slice(2); return d; };

  form.addEventListener('submit', async e => {
    e.preventDefault();
    const { nome, email, whatsapp, aceite } = form.elements;
    if (nome.value.trim().length < 3) return mostrarErro('Escreva o seu nome completo.', nome);
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.value.trim())) return mostrarErro('Confira o e-mail: ele precisa ter o formato voce@exemplo.com.', email);
    const d = digitosWhats(whatsapp.value);
    if (d.length < 10 || d.length > 11) return mostrarErro('Confira o WhatsApp: escreva com o DDD, por exemplo (11) 91234-5678.', whatsapp);
    if (!aceite.checked) return mostrarErro('Para continuar, marque que você aceita os Termos de uso e a Política de privacidade.', aceite);
    mostrarErro('');

    enviar.disabled = true;
    enviar.textContent = 'Gerando o seu código...';
    const limite = new AbortController();
    const relogio = setTimeout(() => limite.abort(), 30000);
    try {
      // text/plain: o Google aceita sem pedir permissão extra ao navegador.
      const resposta = await fetch(raiz.dataset.servidor, {
        method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, signal: limite.signal,
        body: JSON.stringify({ acao: 'cadastrar', nome: nome.value.trim(), email: email.value.trim(), whatsapp: whatsapp.value.trim(), aceite: true })
      });
      const r = await resposta.json();
      if (!r.ok) {
        const campo = { nome, email, whatsapp, aceite, repetido: email }[r.motivo] || null;
        return mostrarErro(r.erro || 'Não foi possível fazer o cadastro agora. Tente de novo em alguns minutos.', campo);
      }
      document.getElementById('codigo').textContent = r.codigo;
      const aviso = document.getElementById('codigo-aviso');
      aviso.textContent = r.jaCadastrado ? (r.mensagem || 'Você já tinha cadastro. Este é o seu código.') : '';
      aviso.hidden = !r.jaCadastrado;
      form.hidden = true;
      pronto.hidden = false;
      pronto.focus();
      pronto.scrollIntoView({ behavior: 'smooth', block: 'center' });
    } catch {
      mostrarErro('Não foi possível falar com o servidor. Confira a internet e tente de novo.');
    } finally {
      clearTimeout(relogio);
      enviar.disabled = false;
      enviar.textContent = textoBotao;
    }
  });

  document.getElementById('copiar').addEventListener('click', async () => {
    const botaoCopiar = document.getElementById('copiar');
    const codigo = document.getElementById('codigo').textContent;
    try {
      await navigator.clipboard.writeText(codigo);
    } catch { // navegador sem acesso à área de transferência: seleciona o código e tenta o jeito antigo de copiar
      const faixa = document.createRange();
      faixa.selectNodeContents(document.getElementById('codigo'));
      getSelection().removeAllRanges(); getSelection().addRange(faixa);
      let copiou = false;
      try { copiou = document.execCommand('copy'); } catch { /* sem cópia: o código fica selecionado para Ctrl+C */ }
      if (!copiou) { botaoCopiar.textContent = 'Use Ctrl+C'; return; }
    }
    botaoCopiar.textContent = 'Copiado ✓';
    setTimeout(() => { botaoCopiar.textContent = 'Copiar'; }, 2500);
  });
})();
