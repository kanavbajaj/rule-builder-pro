import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Layout } from '@/components/Layout';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { fetchProducts } from '@/lib/api';
import type { Product } from '@/lib/types';
import { KNOWN_SCORES } from '@/lib/types';
import { Plus, Search, Package, ArrowRight } from 'lucide-react';

export default function ProductsList() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  useEffect(() => {
    loadProducts();
  }, []);

  async function loadProducts() {
    try {
      const data = await fetchProducts();
      setProducts(data);
    } catch (error) {
      console.error('Failed to load products:', error);
    } finally {
      setLoading(false);
    }
  }

  const filtered = products.filter((p) =>
    p.name.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <Layout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Products</h1>
            <p className="text-muted-foreground mt-1">
              Manage products and their eligibility thresholds
            </p>
          </div>
          <Button asChild>
            <Link to="/products/new">
              <Plus className="h-4 w-4 mr-2" />
              New Product
            </Link>
          </Button>
        </div>

        {/* Search */}
        <div className="relative max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search products..."
            className="pl-10"
          />
        </div>

        {/* Products Grid */}
        {loading ? (
          <div className="text-muted-foreground py-12 text-center">Loading...</div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            {search ? 'No products match your search' : 'No products yet. Create your first product.'}
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {filtered.map((product) => (
              <Link key={product.id} to={`/products/${product.id}`}>
                <Card className="card-elevated hover:border-primary/50 transition-colors cursor-pointer h-full">
                  <CardContent className="pt-6 space-y-4">
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                          <Package className="h-5 w-5 text-primary" />
                        </div>
                        <div>
                          <h3 className="font-semibold">{product.name}</h3>
                          <Badge variant={product.active ? 'default' : 'secondary'} className="mt-1">
                            {product.active ? 'Active' : 'Inactive'}
                          </Badge>
                        </div>
                      </div>
                      <ArrowRight className="h-4 w-4 text-muted-foreground" />
                    </div>

                    {/* Score Thresholds */}
                    {product.required_scores && Object.keys(product.required_scores).length > 0 && (
                      <div className="space-y-1.5">
                        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                          Required Scores
                        </p>
                        <div className="flex flex-wrap gap-1.5">
                          {Object.entries(product.required_scores).map(([score, threshold]) => (
                            <Badge key={score} variant="outline" className="text-xs">
                              {score} ≥ {threshold}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Exclusions */}
                    {product.exclusions && product.exclusions.length > 0 && (
                      <div className="space-y-1.5">
                        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                          Exclusion Tags
                        </p>
                        <div className="flex flex-wrap gap-1.5">
                          {product.exclusions.map((tag) => (
                            <Badge key={tag} variant="destructive" className="text-xs">
                              {tag}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        )}
      </div>
    </Layout>
  );
}
