import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card } from "../../../../shared/components/Card";
import { Button } from "../../../../shared/components/Button";
import { Input } from "../../../../shared/components/Input";
import { Loading } from "../../../../shared/components/Loading";
import { MapView } from "../../../../shared/components/MapView";
import { useToast } from "../../../../shared/components/ToastProvider";
import {
    fetchProviderZones,
    createProviderZone,
    updateProviderZone,
    deleteProviderZone,
    ProviderZone
} from "../../../../shared/libs/providerZones";
import { MapPin, Plus, Trash2, Save, Globe, Info } from "lucide-react";

export const ProviderZonesPage = () => {
    const queryClient = useQueryClient();
    const toast = useToast();
    const [selectedZone, setSelectedZone] = useState<ProviderZone | null>(null);
    const [isAdding, setIsAdding] = useState(false);
    const [formData, setFormData] = useState<Partial<ProviderZone>>({
        name: "",
        description: "",
        centerLat: -1.2921,
        centerLng: 36.8219,
        radiusKm: 5,
        isActive: true
    });

    const { data: zones, isLoading } = useQuery({
        queryKey: ["admin", "provider-zones"],
        queryFn: fetchProviderZones
    });

    const createMutation = useMutation({
        mutationFn: createProviderZone,
        onSuccess: () => {
            toast.showToast({ title: "Zone created", variant: "success" });
            setIsAdding(false);
            queryClient.invalidateQueries({ queryKey: ["admin", "provider-zones"] });
        }
    });

    const updateMutation = useMutation({
        mutationFn: (data: ProviderZone) => updateProviderZone(data.id, data),
        onSuccess: () => {
            toast.showToast({ title: "Zone updated", variant: "success" });
            setSelectedZone(null);
            queryClient.invalidateQueries({ queryKey: ["admin", "provider-zones"] });
        }
    });

    const deleteMutation = useMutation({
        mutationFn: deleteProviderZone,
        onSuccess: () => {
            toast.showToast({ title: "Zone deleted", variant: "success" });
            setSelectedZone(null);
            queryClient.invalidateQueries({ queryKey: ["admin", "provider-zones"] });
        }
    });

    const handleSave = () => {
        if (isAdding) {
            createMutation.mutate(formData);
        } else if (selectedZone) {
            updateMutation.mutate({ ...selectedZone, ...formData } as ProviderZone);
        }
    };

    const handleSelectZone = (zone: ProviderZone) => {
        setSelectedZone(zone);
        setIsAdding(false);
        setFormData(zone);
    };

    const handleStartAdd = () => {
        setIsAdding(true);
        setSelectedZone(null);
        setFormData({
            name: "",
            description: "",
            centerLat: -1.2921,
            centerLng: 36.8219,
            radiusKm: 5,
            isActive: true
        });
    };

    const mapMarkers = zones?.map((z) => ({
        id: z.id,
        position: { lat: z.centerLat, lng: z.centerLng },
        label: z.name,
        color: z.isActive ? "#2563eb" : "#94a3b8"
    })) || [];

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-slate-900">Geographic Zones</h1>
                    <p className="text-sm text-slate-500">Define operational boundaries for AI-powered provider broadcasts.</p>
                </div>
                <Button onClick={handleStartAdd} disabled={isAdding}>
                    <Plus className="mr-2 h-4 w-4" />
                    Define New Zone
                </Button>
            </div>

            <div className="grid gap-6 lg:grid-cols-3">
                <div className="lg:col-span-1 space-y-4">
                    <Card title="Operational Zones" description="Click a zone to manage its configuration.">
                        {isLoading ? (
                            <Loading />
                        ) : zones?.length === 0 ? (
                            <div className="py-12 text-center text-slate-500">
                                <Globe className="mx-auto h-12 w-12 opacity-20 mb-4" />
                                <p>No zones defined yet.</p>
                            </div>
                        ) : (
                            <div className="space-y-2">
                                {zones?.map((zone) => (
                                    <button
                                        key={zone.id}
                                        onClick={() => handleSelectZone(zone)}
                                        className={`w-full text-left p-4 rounded-2xl border transition ${selectedZone?.id === zone.id
                                                ? "border-primary-500 bg-primary-50 ring-1 ring-primary-500"
                                                : "border-slate-100 hover:border-primary-200 hover:bg-slate-50"
                                            }`}
                                    >
                                        <div className="flex items-center justify-between">
                                            <span className="font-semibold text-slate-900">{zone.name}</span>
                                            <span className={`px-2 py-0.5 rounded-full text-[10px] uppercase font-bold tracking-wider ${zone.isActive ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-600"
                                                }`}>
                                                {zone.isActive ? "Active" : "Disabled"}
                                            </span>
                                        </div>
                                        <div className="mt-2 flex items-center gap-3 text-xs text-slate-500">
                                            <span className="flex items-center gap-1">
                                                <MapPin className="h-3 w-3" />
                                                {zone.radiusKm}km radius
                                            </span>
                                            <span>•</span>
                                            <span>{zone.providerCount || 0} providers</span>
                                        </div>
                                    </button>
                                ))}
                            </div>
                        )}
                    </Card>
                </div>

                <div className="lg:col-span-2 space-y-6">
                    <div className="rounded-[32px] overflow-hidden border border-slate-200 shadow-xl bg-slate-50">
                        <MapView
                            height={400}
                            center={
                                selectedZone
                                    ? { lat: selectedZone.centerLat, lng: selectedZone.centerLng }
                                    : { lat: -1.2921, lng: 36.8219 }
                            }
                            zoom={11}
                            markers={mapMarkers}
                            intent="admin"
                        />
                    </div>

                    {(selectedZone || isAdding) && (
                        <Card
                            title={isAdding ? "New Geographic Zone" : `Edit Zone: ${selectedZone?.name}`}
                            description="Coordinate system uses decimal degrees. Radius is in kilometers."
                        >
                            <div className="grid gap-6 md:grid-cols-2">
                                <Input
                                    label="Zone Name"
                                    value={formData.name}
                                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                    placeholder="e.g. Nairobi Central"
                                />
                                <Input
                                    label="Description"
                                    value={formData.description || ""}
                                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                                    placeholder="Internal notes..."
                                />
                                <Input
                                    label="Center Latitude"
                                    type="number"
                                    step="0.0001"
                                    value={formData.centerLat}
                                    onChange={(e) => setFormData({ ...formData, centerLat: Number(e.target.value) })}
                                />
                                <Input
                                    label="Center Longitude"
                                    type="number"
                                    step="0.0001"
                                    value={formData.centerLng}
                                    onChange={(e) => setFormData({ ...formData, centerLng: Number(e.target.value) })}
                                />
                                <Input
                                    label="Radius (km)"
                                    type="number"
                                    value={formData.radiusKm}
                                    onChange={(e) => setFormData({ ...formData, radiusKm: Number(e.target.value) })}
                                />
                                <div className="flex items-center gap-4 pt-8">
                                    <label className="flex items-center gap-2 text-sm font-semibold text-slate-700">
                                        <input
                                            type="checkbox"
                                            checked={formData.isActive}
                                            onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
                                            className="h-4 w-4 rounded border-slate-300 text-primary-600 focus:ring-primary-500"
                                        />
                                        Active Zone
                                    </label>
                                </div>
                            </div>

                            <div className="mt-8 flex items-center justify-between border-t border-slate-100 pt-6">
                                {!isAdding && selectedZone && (
                                    <Button
                                        variant="ghost"
                                        className="text-rose-600 hover:bg-rose-50"
                                        onClick={() => {
                                            if (window.confirm("Delete this zone? Providers in this area will fall back to default logic.")) {
                                                deleteMutation.mutate(selectedZone.id);
                                            }
                                        }}
                                        disabled={deleteMutation.isPending}
                                    >
                                        <Trash2 className="mr-2 h-4 w-4" />
                                        Delete Zone
                                    </Button>
                                )}
                                <div className="flex gap-3 ml-auto">
                                    <Button variant="secondary" onClick={() => { setSelectedZone(null); setIsAdding(false); }}>
                                        Cancel
                                    </Button>
                                    <Button onClick={handleSave} loading={createMutation.isPending || updateMutation.isPending}>
                                        <Save className="mr-2 h-4 w-4" />
                                        {isAdding ? "Create Zone" : "Save Changes"}
                                    </Button>
                                </div>
                            </div>
                        </Card>
                    )}

                    {!selectedZone && !isAdding && (
                        <div className="flex flex-col items-center justify-center py-20 bg-slate-50/50 rounded-[32px] border-2 border-dashed border-slate-200">
                            <Info className="h-10 w-10 text-slate-300 mb-4" />
                            <p className="text-slate-500 font-medium">Select a zone or create a new one to manage geographic settings.</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default ProviderZonesPage;
