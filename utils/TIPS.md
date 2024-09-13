


```bash
for i in {1..10}; do echo "====private-keys-$i====" >> .secrets2 ; bun run src/keyGeneratorCli.ts generate >> .secrets2 ; echo "" >> .secrets2 ; done
```

