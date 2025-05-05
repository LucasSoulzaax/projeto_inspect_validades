
        document.addEventListener("DOMContentLoaded", () => {
            
            const btnCadastrar = document.getElementById("btnCadastrar");
            const btnFiltrar = document.getElementById("btnFiltrar");
            const btnMostrarVencidos = document.getElementById("btnMostrarVencidos");
            const btnAprovar = document.getElementById("btnAprovar");
            const btnCancelar = document.getElementById("btnCancelar");
            const campoAprovar = document.getElementById("campo_aprovar");
            const selectAprovar = document.getElementById("aprovar");
            const labelExplicar = document.getElementById("labelExplicar");

           
            let produtos = [];
            let justificativas = [];
            let filtroApenasVencidos = false;

            
            carregarDadosIniciais();
            gerarCodigoProduto();

            
            btnCadastrar.addEventListener("click", cadastrarProduto);
            btnFiltrar.addEventListener("click", aplicarFiltros);
            btnMostrarVencidos.addEventListener("click", toggleFiltroVencidos);
            btnAprovar.addEventListener("click", aprovarAlteracao);
            btnCancelar.addEventListener("click", () => campoAprovar.classList.add("hidden"));
            selectAprovar.addEventListener("change", atualizarLabelJustificativa);

            
            function showToast(message, type = 'success') {
                const toast = document.createElement('div');
                toast.className = `toast ${type}`;
                toast.textContent = message;
                document.body.appendChild(toast);
                setTimeout(() => toast.remove(), 3000);
            }

            function formatarData(data) {
                if (!data) return 'N/A';
                try {
                    const dateObj = new Date(data);
                    return dateObj.toISOString().split('T')[0];
                } catch {
                    return data;
                }
            }

            function gerarCodigoProduto() {
                const codigo = 'PRD-' + Math.random().toString(36).substr(2, 9).toUpperCase();
                document.getElementById("codigo").value = codigo;
                return codigo;
            }

            function atualizarLabelJustificativa() {
                const valor = selectAprovar.value;
                labelExplicar.textContent = valor === 'sim' ? 'Justificativa de Reprocessamento:' : 'Motivo da Reprovação:';
            }

            
            async function carregarDadosIniciais() {
                try {
                    showToast("Carregando dados...", "warning");
                    
                    const [produtosResponse, justificativasResponse] = await Promise.all([
                        fetch("https://inspect-25qs.onrender.com/produtos"),
                        fetch("https://inspect-25qs.onrender.com/inspetor")
                    ]);

                    if (!produtosResponse.ok || !justificativasResponse.ok) {
                        throw new Error("Erro ao carregar dados");
                    }

                    produtos = await produtosResponse.json();
                    justificativas = await justificativasResponse.json();

                    atualizarListaInspecao(produtos);
                    atualizarRelatorios();
                    showToast("Dados carregados com sucesso!");
                } catch (error) {
                    console.error("Erro ao carregar dados:", error);
                    showToast("Erro ao carregar dados", "error");
                }
            }

            function aplicarFiltros() {
                const filtroNome = document.getElementById("filtroNome").value.toLowerCase();
                let produtosFiltrados = produtos;

                if (filtroNome) {
                    produtosFiltrados = produtosFiltrados.filter(p => 
                        p.nome.toLowerCase().includes(filtroNome))
                }

                if (filtroApenasVencidos) {
                    produtosFiltrados = produtosFiltrados.filter(p => 
                        new Date(p.validade) < new Date())
                }

                atualizarListaInspecao(produtosFiltrados);
            }

            function toggleFiltroVencidos() {
                filtroApenasVencidos = !filtroApenasVencidos;
                btnMostrarVencidos.textContent = filtroApenasVencidos 
                    ? "Mostrar Todos" 
                    : "Mostrar Apenas Vencidos";
                aplicarFiltros();
            }

            
            function atualizarListaInspecao(produtosParaExibir) {
                const tabela = document.getElementById("corpo_produtos");
                
                tabela.innerHTML = produtosParaExibir.map(produto => {
                    const estaVencido = new Date(produto.validade) < new Date();
                    const dataFormatada = formatarData(produto.validade);
                    
                    return `
                        <tr data-id="${produto.id}" data-vencido="${estaVencido}">
                            <td class="readonly">${produto.codigo || 'N/A'}</td>
                            <td class="readonly">${produto.nome}</td>
                            <td class="readonly">${produto.descricao || 'Sem descrição'}</td>
                            <td><input type="date" class="input-validade" value="${dataFormatada}" ${produto.status === 'descartado' ? 'disabled' : ''}></td>
                            <td>
                                <select class="statusProduto" ${produto.status === 'descartado' ? 'disabled' : ''}>
                                    <option value="novo" ${produto.status === 'novo' ? 'selected' : ''}>Novo</option>
                                    <option value="reprocessado" ${produto.status === 'reprocessado' ? 'selected' : ''}>Reprocessado</option>
                                    <option value="descartado">Descartado</option>
                                </select>
                            </td>
                            <td>
                                <button class="btnSelecionarProduto" data-produto-id="${produto.id}" ${!estaVencido ? 'disabled' : ''}>
                                    ${!estaVencido ? 'Produto não vencido' : 'Selecionar'}
                                </button>
                            </td>
                        </tr>
                    `;
                }).join('') || '<tr><td colspan="6">Nenhum produto encontrado</td></tr>';

                
                document.querySelectorAll(".btnSelecionarProduto").forEach(btn => {
                    btn.addEventListener("click", function() {
                        if (this.disabled) {
                            showToast("Atenção: Este produto não está vencido!", "warning");
                            return;
                        }

                        const row = this.closest("tr");
                        const produto = {
                            id: this.dataset.produtoId,
                            nome: row.cells[1].textContent,
                            status: row.querySelector(".statusProduto").value,
                            validade: row.querySelector(".input-validade").value
                        };

                        prepararFormularioAprovacao(produto);
                    });
                });
            }

            function prepararFormularioAprovacao(produto) {
                document.getElementById("produtoId").value = produto.id;
                document.getElementById("nomeProdutoAprovacao").textContent = produto.nome;
                document.getElementById("statusProdutoAprovacao").textContent = produto.status;
                document.getElementById("novaValidade").value = produto.validade;
                document.getElementById("aprovar").value = "nao";
                document.getElementById("explicar").value = "";
                
                campoAprovar.classList.remove("hidden");
                atualizarLabelJustificativa();
            }

            function atualizarRelatorios() {
                
                const produtosValidos = produtos.filter(p => 
                    !["reprocessado", "descartado"].includes(p.status) && 
                    new Date(p.validade) >= new Date()
                );
                document.getElementById("lista-validade").innerHTML = produtosValidos
                    .map(p => `<li>${p.nome} - Validade: ${formatarData(p.validade)}</li>`)
                    .join('') || '<li>Nenhum produto na validade</li>';

                
                const reprocessados = [...new Set(
                    produtos.filter(p => p.status === "reprocessado").map(p => p.nome)
                )];
                document.getElementById("lista-reprocessados").innerHTML = reprocessados
                    .map(nome => `<li>${nome}</li>`)
                    .join('') || '<li>Nenhum produto reprocessado</li>';

                
                const descartados = produtos.filter(p => p.status === "descartado");
                document.getElementById("lista-descartados").innerHTML = descartados
                    .map(p => `<li>${p.nome} - ${formatarData(p.updatedAt)} ${p.justificativa ? `| Motivo: ${p.justificativa}` : ''}</li>`)
                    .join('') || '<li>Nenhum item descartado</li>';

                
                document.getElementById("lista-justificativas").innerHTML = justificativas
                    .map(j => `<li><strong>${j.nome}</strong>: ${j.justificativa}</li>`)
                    .join('') || '<li>Nenhuma justificativa registrada</li>';
            }

            
            async function cadastrarProduto() {
                const codigo = document.getElementById("codigo").value;
                const nome = document.getElementById("nome").value.trim();
                const descricao = document.getElementById("descricao").value.trim();
                const validade = document.getElementById("validade").value;
                const status = document.getElementById("estado").value;

                if (!nome || !validade || !status) {
                    showToast("Preencha todos os campos obrigatórios!", "error");
                    return;
                }

                try {
                    showToast("Cadastrando produto...", "warning");
                    
                    const response = await fetch("https://inspect-25qs.onrender.com/produtos", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ codigo, nome, descricao, validade, status })
                    });

                    if (!response.ok) {
                        const error = await response.json();
                        throw new Error(error.message || "Erro ao cadastrar produto");
                    }

                    showToast("Produto cadastrado com sucesso!");
                    document.getElementById("nome").value = "";
                    document.getElementById("descricao").value = "";
                    gerarCodigoProduto();
                    await carregarDadosIniciais();
                } catch (error) {
                    console.error("Erro ao cadastrar:", error);
                    showToast(`Erro: ${error.message}`, "error");
                }
            }

            async function aprovarAlteracao() {
                const produtoId = document.getElementById("produtoId").value;
                
                if (!produtoId) {
                    showToast("Selecione um produto primeiro!", "error");
                    return;
                }

                const aprovado = document.getElementById("aprovar").value;
                const justificativa = document.getElementById("explicar").value.trim();
                const novaValidade = document.getElementById("novaValidade").value;

                const statusFinal = aprovado === "sim" 
                    ? document.getElementById("statusProdutoAprovacao").textContent 
                    : "descartado";

                if (statusFinal === "descartado" && !justificativa) {
                    showToast("Informe a justificativa para descartar!", "error");
                    return;
                }

                try {
                    showToast("Processando aprovação...", "warning");
                    
                    
                    const dadosAtualizacao = {
                        status: statusFinal,
                        validade: novaValidade
                    };

                    const response = await fetch(`https://inspect-25qs.onrender.com/produtos/${produtoId}`, {
                        method: "PUT",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify(dadosAtualizacao)
                    });

                    if (!response.ok) {
                        const error = await response.json();
                        throw new Error(error.message || "Erro ao atualizar produto");
                    }

                    
                    if (statusFinal === "descartado") {
                        const nomeProduto = document.getElementById("nomeProdutoAprovacao").textContent;
                        await fetch("https://inspect-25qs.onrender.com/inspetor", {
                            method: "POST",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({ 
                                nome: nomeProduto, 
                                justificativa 
                            })
                        });
                    }

                    showToast(`Produto atualizado como ${statusFinal.toUpperCase()}!`);
                    campoAprovar.classList.add("hidden");
                    await carregarDadosIniciais();
                } catch (error) {
                    console.error("Erro ao aprovar:", error);
                    showToast(`Erro: ${error.message}`, "error");
                }
            }
        });
